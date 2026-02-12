const fs = require('fs');
const csv = require('csv-parser');
const { pipeline } = require('stream/promises');

class CSVService {
  constructor() {
    this.requiredColumns = ['Title'];
    this.optionalColumns = [
      'Handle', 'Body (HTML)', 'Vendor', 'Type', 'Tags',
      'Published', 'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value',
      'Option3 Name', 'Option3 Value', 'Variant SKU', 'Variant Grams',
      'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy',
      'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price',
      'Variant Requires Shipping', 'Variant Taxable', 'Variant Barcode',
      'Image Src', 'Image Position', 'Image Alt Text', 'Gift Card',
      'SEO Title', 'SEO Description', 'Google Shopping / Google Product Category',
      'Google Shopping / Gender', 'Google Shopping / Age Group', 'Google Shopping / MPN',
      'Google Shopping / AdWords Grouping', 'Google Shopping / AdWords Labels',
      'Google Shopping / Condition', 'Google Shopping / Custom Product',
      'Google Shopping / Custom Label 0', 'Google Shopping / Custom Label 1',
      'Google Shopping / Custom Label 2', 'Google Shopping / Custom Label 3',
      'Google Shopping / Custom Label 4', 'Variant Image', 'Variant Weight Unit',
      'Variant Tax Code', 'Cost per item', 'Status'
    ];
  }

  /**
   * Validate CSV file structure
   */
  async validateCSV(filePath) {
    return new Promise((resolve, reject) => {
      const headers = [];
      let isFirstRow = true;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headers.push(...headerList);
        })
        .on('data', () => {
          // Just validate headers, stop after first row
          if (isFirstRow) {
            isFirstRow = false;
          }
        })
        .on('end', () => {
          // Check if required columns are present
          const hasTitle = headers.some(h => h.toLowerCase() === 'title');

          if (!hasTitle) {
            reject(new Error('CSV must contain a "Title" column'));
          }

          resolve({
            valid: true,
            headers,
            message: 'CSV validation passed'
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Parse CSV file and convert to product objects
   */
  async parseCSV(filePath, progressCallback) {
    try {
      // First, validate the CSV
      await this.validateCSV(filePath);

      // Count total rows for progress tracking
      const totalRows = await this.countRows(filePath);

      progressCallback(10);

      const products = [];
      const productMap = new Map(); // Group variants by handle
      let processedRows = 0;

      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            processedRows++;

            // Normalize row keys (handle different CSV formats)
            const normalizedRow = this.normalizeRow(row);

            // Group products by handle
            const handle = normalizedRow.handle || this.generateHandle(normalizedRow.title);

            if (!productMap.has(handle)) {
              // New product
              const product = this.rowToProduct(normalizedRow, handle);
              productMap.set(handle, product);
            } else {
              // Additional variant for existing product
              const product = productMap.get(handle);
              this.addVariantToProduct(product, normalizedRow);
            }

            // Update progress
            const progress = 10 + (processedRows / totalRows) * 80;
            if (processedRows % 100 === 0 || processedRows === totalRows) {
              progressCallback(progress);
            }
          })
          .on('end', () => {
            // Convert map to array
            const productsArray = Array.from(productMap.values());

            progressCallback(100);

            resolve(productsArray);
          })
          .on('error', (error) => {
            reject(error);
          });
      });

    } catch (error) {
      console.error('CSV parsing error:', error);
      throw error;
    }
  }

  /**
   * Count total rows in CSV file
   */
  async countRows(filePath) {
    return new Promise((resolve, reject) => {
      let count = 0;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', () => count++)
        .on('end', () => resolve(count))
        .on('error', reject);
    });
  }

  /**
   * Normalize row keys to lowercase and remove special characters
   */
  normalizeRow(row) {
    const normalized = {};

    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key
        .toLowerCase()
        .replace(/[()]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_');

      normalized[normalizedKey] = value;
    }

    return normalized;
  }

  /**
   * Convert CSV row to product object
   */
  rowToProduct(row, handle) {
    const product = {
      handle: handle,
      title: row.title || '',
      body_html: row.body_html || row.body || row.description || '',
      vendor: row.vendor || '',
      type: row.type || row.product_type || '',
      tags: row.tags || '',
      status: row.published === 'TRUE' || row.status === 'active' ? 'active' : 'draft',
      variants: [],
      images: []
    };

    // Add first variant
    this.addVariantToProduct(product, row);

    // Add image if present
    if (row.image_src) {
      product.images.push({
        src: row.image_src,
        alt: row.image_alt_text || row.title,
        position: parseInt(row.image_position) || 1
      });
    }

    return product;
  }

  /**
   * Add a variant to a product
   */
  addVariantToProduct(product, row) {
    const variant = {
      variant_price: row.variant_price || '0.00',
      variant_compare_at_price: row.variant_compare_at_price || null,
      variant_sku: row.variant_sku || '',
      variant_inventory_qty: row.variant_inventory_qty || '0',
      variant_weight: row.variant_grams ? parseFloat(row.variant_grams) / 1000 : null,
      variant_weight_unit: row.variant_weight_unit || 'kg',
      variant_barcode: row.variant_barcode || '',
      variant_requires_shipping: row.variant_requires_shipping !== 'FALSE',
      variant_taxable: row.variant_taxable !== 'FALSE',
      options: {}
    };

    // Add options
    if (row.option1_name && row.option1_value) {
      variant.options[row.option1_name] = row.option1_value;
    }
    if (row.option2_name && row.option2_value) {
      variant.options[row.option2_name] = row.option2_value;
    }
    if (row.option3_name && row.option3_value) {
      variant.options[row.option3_name] = row.option3_value;
    }

    product.variants.push(variant);
  }

  /**
   * Generate a URL-friendly handle from title
   */
  generateHandle(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Export products to Shopify CSV format
   */
  async exportToCSV(products, outputPath) {
    const rows = [];

    products.forEach(product => {
      product.variants.forEach((variant, index) => {
        const row = {
          'Handle': product.handle,
          'Title': index === 0 ? product.title : '',
          'Body (HTML)': index === 0 ? product.body_html : '',
          'Vendor': index === 0 ? product.vendor : '',
          'Type': index === 0 ? product.type : '',
          'Tags': index === 0 ? product.tags : '',
          'Published': product.status === 'active' ? 'TRUE' : 'FALSE',
          'Variant SKU': variant.variant_sku,
          'Variant Grams': variant.variant_weight ? variant.variant_weight * 1000 : '',
          'Variant Inventory Qty': variant.variant_inventory_qty,
          'Variant Price': variant.variant_price,
          'Variant Compare At Price': variant.variant_compare_at_price || '',
          'Image Src': index === 0 && product.images[0] ? product.images[0].src : '',
          'Image Alt Text': index === 0 && product.images[0] ? product.images[0].alt : ''
        };

        rows.push(row);
      });
    });

    // Write CSV
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');

    fs.writeFileSync(outputPath, csvContent);

    return outputPath;
  }

  /**
   * Get CSV statistics
   */
  async getCSVStats(filePath) {
    const products = await this.parseCSV(filePath, () => {});

    const stats = {
      totalProducts: products.length,
      totalVariants: products.reduce((sum, p) => sum + p.variants.length, 0),
      withImages: products.filter(p => p.images.length > 0).length,
      vendors: [...new Set(products.map(p => p.vendor).filter(Boolean))],
      types: [...new Set(products.map(p => p.type).filter(Boolean))]
    };

    return stats;
  }
}

module.exports = CSVService;
