const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;

class WooCommerceService {
  constructor(url, consumerKey, consumerSecret) {
    this.api = new WooCommerceRestApi({
      url: url,
      consumerKey: consumerKey,
      consumerSecret: consumerSecret,
      version: 'wc/v3',
      queryStringAuth: true // Force Basic Authentication
    });
  }

  /**
   * Test connection to WooCommerce store
   */
  async testConnection() {
    try {
      const response = await this.api.get('system_status');
      return response.status === 200;
    } catch (error) {
      console.error('WooCommerce connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get total number of products
   */
  async getTotalProducts() {
    try {
      const response = await this.api.get('products', {
        per_page: 1,
        page: 1
      });

      // Total count is in the headers
      const totalProducts = parseInt(response.headers['x-wp-total']) || 0;
      return totalProducts;
    } catch (error) {
      console.error('Error getting total products:', error.message);
      throw error;
    }
  }

  /**
   * Fetch a single page of products
   */
  async fetchProductsPage(page, perPage = 100) {
    try {
      const response = await this.api.get('products', {
        per_page: perPage,
        page: page,
        // Include variations in the response
        _fields: 'id,name,type,status,description,short_description,sku,price,regular_price,sale_price,categories,tags,images,attributes,variations,stock_quantity,weight,dimensions'
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching products page ${page}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch product variations for a variable product
   */
  async fetchProductVariations(productId) {
    try {
      const variations = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.api.get(`products/${productId}/variations`, {
          per_page: 100,
          page: page
        });

        variations.push(...response.data);

        // Check if there are more pages
        const totalPages = parseInt(response.headers['x-wp-totalpages']) || 1;
        hasMore = page < totalPages;
        page++;
      }

      return variations;
    } catch (error) {
      console.error(`Error fetching variations for product ${productId}:`, error.message);
      return [];
    }
  }

  /**
   * Fetch all products with pagination and progress tracking
   */
  async fetchAllProducts(progressCallback) {
    try {
      // Get total count first
      const totalProducts = await this.getTotalProducts();

      progressCallback(5, {
        message: `Found ${totalProducts} products in WooCommerce store`,
        totalProducts
      });

      const products = [];
      const perPage = 100; // Max allowed by WooCommerce is 100
      const totalPages = Math.ceil(totalProducts / perPage);

      // Fetch products page by page
      for (let page = 1; page <= totalPages; page++) {
        progressCallback((page / totalPages) * 90, {
          message: `Fetching products: page ${page}/${totalPages}`,
          currentPage: page,
          totalPages,
          productsLoaded: products.length
        });

        const pageProducts = await this.fetchProductsPage(page, perPage);
        products.push(...pageProducts);

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Fetch variations for variable products
      const variableProducts = products.filter(p => p.type === 'variable');

      if (variableProducts.length > 0) {
        progressCallback(90, {
          message: `Fetching variations for ${variableProducts.length} variable products...`,
          variableProductsCount: variableProducts.length
        });

        for (let i = 0; i < variableProducts.length; i++) {
          const product = variableProducts[i];

          progressCallback(90 + (i / variableProducts.length) * 10, {
            message: `Fetching variations for "${product.name}" (${i + 1}/${variableProducts.length})`,
            currentProduct: i + 1,
            totalVariableProducts: variableProducts.length
          });

          const variations = await this.fetchProductVariations(product.id);
          product.variations = variations;

          // Add a small delay
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      progressCallback(100, {
        message: `Successfully fetched ${products.length} products`,
        totalProducts: products.length,
        variableProducts: variableProducts.length
      });

      return products;

    } catch (error) {
      console.error('Error fetching all products:', error);
      throw error;
    }
  }

  /**
   * Batch fetch products (alternative approach using batch endpoint)
   */
  async batchFetchProducts(productIds) {
    try {
      // WooCommerce batch endpoint can handle up to 100 items
      const batchSize = 100;
      const batches = [];

      for (let i = 0; i < productIds.length; i += batchSize) {
        batches.push(productIds.slice(i, i + batchSize));
      }

      const products = [];

      for (const batch of batches) {
        const requests = batch.map(id => ({
          method: 'GET',
          path: `/wc/v3/products/${id}`
        }));

        const response = await this.api.post('batch', { requests });
        const batchProducts = response.data.map(r => r.body);
        products.push(...batchProducts);
      }

      return products;
    } catch (error) {
      console.error('Batch fetch error:', error);
      throw error;
    }
  }
}

module.exports = WooCommerceService;
