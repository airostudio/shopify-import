const axios = require('axios');

class ShopifyService {
  constructor(shopName, accessToken, apiVersion = '2026-01') {
    this.shopName = shopName;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
    this.baseUrl = `https://${shopName}.myshopify.com/admin/api/${apiVersion}`;
    this.graphqlUrl = `${this.baseUrl}/graphql.json`;
  }

  /**
   * Test connection to Shopify store
   */
  async testConnection() {
    try {
      const response = await this.graphqlRequest(`
        query {
          shop {
            name
            email
          }
        }
      `);
      return response.data && response.data.shop;
    } catch (error) {
      console.error('Shopify connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Make a GraphQL request to Shopify
   */
  async graphqlRequest(query, variables = {}) {
    try {
      const response = await axios.post(
        this.graphqlUrl,
        {
          query,
          variables
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.accessToken
          }
        }
      );

      if (response.data.errors) {
        throw new Error(JSON.stringify(response.data.errors));
      }

      return response.data;
    } catch (error) {
      console.error('GraphQL request failed:', error.message);
      throw error;
    }
  }

  /**
   * Transform product data to Shopify JSONL format
   */
  transformToShopifyFormat(products) {
    return products.map(product => {
      // Handle different source formats (WooCommerce vs CSV)
      const isWooCommerce = product.id !== undefined;

      return {
        input: {
          title: product.title || product.name,
          descriptionHtml: product.body_html || product.description || '',
          vendor: product.vendor || '',
          productType: product.type || product.categories?.[0]?.name || '',
          tags: this.formatTags(product),
          status: this.mapStatus(product.status),
          variants: this.transformVariants(product, isWooCommerce),
          images: this.transformImages(product, isWooCommerce)
        }
      };
    });
  }

  /**
   * Format tags for Shopify
   */
  formatTags(product) {
    if (product.tags) {
      return Array.isArray(product.tags) ? product.tags : product.tags.split(',').map(t => t.trim());
    }
    return [];
  }

  /**
   * Map product status to Shopify format
   */
  mapStatus(status) {
    const statusMap = {
      'publish': 'ACTIVE',
      'published': 'ACTIVE',
      'draft': 'DRAFT',
      'active': 'ACTIVE'
    };
    return statusMap[status?.toLowerCase()] || 'DRAFT';
  }

  /**
   * Transform product variants
   */
  transformVariants(product, isWooCommerce) {
    if (isWooCommerce && product.variations && product.variations.length > 0) {
      return product.variations.map(variant => ({
        price: variant.price || variant.regular_price || '0.00',
        compareAtPrice: variant.regular_price !== variant.price ? variant.regular_price : null,
        sku: variant.sku || '',
        inventoryQuantities: variant.stock_quantity ? [{
          availableQuantity: parseInt(variant.stock_quantity),
          locationId: 'gid://shopify/Location/1' // Default location
        }] : [],
        weight: variant.weight ? parseFloat(variant.weight) : null,
        weightUnit: 'GRAMS',
        options: this.extractVariantOptions(variant)
      }));
    } else if (product.variants && product.variants.length > 0) {
      // CSV format variants
      return product.variants.map(variant => ({
        price: variant.variant_price || '0.00',
        compareAtPrice: variant.variant_compare_at_price || null,
        sku: variant.variant_sku || '',
        inventoryQuantities: variant.variant_inventory_qty ? [{
          availableQuantity: parseInt(variant.variant_inventory_qty),
          locationId: 'gid://shopify/Location/1'
        }] : [],
        weight: variant.variant_weight ? parseFloat(variant.variant_weight) * 1000 : null, // Convert to grams
        weightUnit: 'GRAMS'
      }));
    } else {
      // Single variant product
      return [{
        price: product.variant_price || product.price || product.regular_price || '0.00',
        compareAtPrice: product.variant_compare_at_price || null,
        sku: product.variant_sku || product.sku || '',
        inventoryQuantities: product.variant_inventory_qty || product.stock_quantity ? [{
          availableQuantity: parseInt(product.variant_inventory_qty || product.stock_quantity),
          locationId: 'gid://shopify/Location/1'
        }] : []
      }];
    }
  }

  /**
   * Extract variant options from WooCommerce variant
   */
  extractVariantOptions(variant) {
    const options = [];
    if (variant.attributes) {
      variant.attributes.forEach(attr => {
        options.push(attr.option);
      });
    }
    return options;
  }

  /**
   * Transform product images
   */
  transformImages(product, isWooCommerce) {
    const images = [];

    if (isWooCommerce) {
      if (product.images && product.images.length > 0) {
        product.images.forEach(img => {
          images.push({
            src: img.src,
            altText: img.alt || product.name
          });
        });
      }
    } else {
      // CSV format
      if (product.image_src) {
        images.push({
          src: product.image_src,
          altText: product.image_alt_text || product.title
        });
      }
    }

    return images;
  }

  /**
   * Create JSONL file content for bulk operations
   */
  createJSONL(products) {
    const transformed = this.transformToShopifyFormat(products);
    return transformed.map(product => JSON.stringify(product)).join('\n');
  }

  /**
   * Upload JSONL file to Shopify's staged upload target
   */
  async uploadJSONL(jsonlContent) {
    // Step 1: Get staged upload URL
    const stagedUploadMutation = `
      mutation {
        stagedUploadsCreate(input: [{
          resource: BULK_MUTATION_VARIABLES,
          filename: "bulk-import-${Date.now()}.jsonl",
          mimeType: "text/jsonl",
          httpMethod: POST
        }]) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const uploadResponse = await this.graphqlRequest(stagedUploadMutation);

    if (uploadResponse.data.stagedUploadsCreate.userErrors.length > 0) {
      throw new Error(JSON.stringify(uploadResponse.data.stagedUploadsCreate.userErrors));
    }

    const stagedTarget = uploadResponse.data.stagedUploadsCreate.stagedTargets[0];

    // Step 2: Upload JSONL to staged target
    const formData = new FormData();
    stagedTarget.parameters.forEach(param => {
      formData.append(param.name, param.value);
    });
    formData.append('file', jsonlContent);

    await axios.post(stagedTarget.url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return stagedTarget.resourceUrl;
  }

  /**
   * Start a bulk import operation
   */
  async startBulkOperation(resourceUrl) {
    const bulkOperationMutation = `
      mutation {
        bulkOperationRunMutation(
          mutation: "mutation call($input: ProductInput!) { productCreate(input: $input) { product {id title} userErrors { message field } } }",
          stagedUploadPath: "${resourceUrl}"
        ) {
          bulkOperation {
            id
            status
            createdAt
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.graphqlRequest(bulkOperationMutation);

    if (response.data.bulkOperationRunMutation.userErrors.length > 0) {
      throw new Error(JSON.stringify(response.data.bulkOperationRunMutation.userErrors));
    }

    return response.data.bulkOperationRunMutation.bulkOperation;
  }

  /**
   * Poll bulk operation status
   */
  async pollBulkOperationStatus(operationId) {
    const query = `
      query {
        node(id: "${operationId}") {
          ... on BulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
            partialDataUrl
          }
        }
      }
    `;

    const response = await this.graphqlRequest(query);
    return response.data.node;
  }

  /**
   * Main bulk import method with progress tracking
   */
  async bulkImport(products, progressCallback) {
    try {
      const batchSize = 10000; // Process in batches due to 100MB JSONL limit
      const batches = [];

      // Split products into batches
      for (let i = 0; i < products.length; i += batchSize) {
        batches.push(products.slice(i, i + batchSize));
      }

      progressCallback(0, {
        message: `Preparing ${batches.length} batch(es) for import...`,
        totalBatches: batches.length,
        totalProducts: products.length
      });

      const operations = [];

      // Start bulk operations (max 5 concurrent in API version 2026-01)
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        progressCallback((i / batches.length) * 20, {
          message: `Creating JSONL for batch ${i + 1}/${batches.length}...`,
          currentBatch: i + 1,
          totalBatches: batches.length
        });

        const jsonl = this.createJSONL(batch);

        progressCallback((i / batches.length) * 20 + 5, {
          message: `Uploading batch ${i + 1}/${batches.length}...`,
          currentBatch: i + 1,
          totalBatches: batches.length
        });

        const resourceUrl = await this.uploadJSONL(jsonl);

        progressCallback((i / batches.length) * 20 + 10, {
          message: `Starting import for batch ${i + 1}/${batches.length}...`,
          currentBatch: i + 1,
          totalBatches: batches.length
        });

        const operation = await this.startBulkOperation(resourceUrl);
        operations.push({ ...operation, batchIndex: i });

        // Wait a bit between starting operations to avoid rate limits
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Poll all operations for completion
      let completedCount = 0;
      const pollInterval = 5000; // 5 seconds

      while (completedCount < operations.length) {
        for (const operation of operations) {
          if (operation.completed) continue;

          const status = await this.pollBulkOperationStatus(operation.id);

          if (status.status === 'COMPLETED') {
            operation.completed = true;
            completedCount++;

            progressCallback(40 + (completedCount / operations.length) * 60, {
              message: `Batch ${operation.batchIndex + 1}/${batches.length} completed (${status.objectCount} products)`,
              completedBatches: completedCount,
              totalBatches: batches.length,
              objectCount: status.objectCount
            });
          } else if (status.status === 'FAILED' || status.status === 'CANCELED') {
            throw new Error(`Bulk operation ${operation.id} failed: ${status.errorCode}`);
          } else {
            progressCallback(40 + (completedCount / operations.length) * 60, {
              message: `Batch ${operation.batchIndex + 1}/${batches.length}: ${status.status}...`,
              status: status.status,
              completedBatches: completedCount,
              totalBatches: batches.length
            });
          }
        }

        if (completedCount < operations.length) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }

      progressCallback(100, {
        message: `Import completed! ${products.length} products processed.`,
        totalProducts: products.length,
        completedBatches: batches.length
      });

    } catch (error) {
      console.error('Bulk import error:', error);
      throw error;
    }
  }
}

module.exports = ShopifyService;
