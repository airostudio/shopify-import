import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Collapse
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import axios from 'axios';

function ShopifyConfig({ config, onChange }) {
  const [shopName, setShopName] = useState(config.shopName || '');
  const [accessToken, setAccessToken] = useState(config.accessToken || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await axios.post('/api/test/shopify', {
        shopName,
        accessToken
      });

      setTestResult({
        success: response.data.success,
        message: response.data.message
      });

      if (response.data.success) {
        onChange({ shopName, accessToken });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.error || error.message
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="h6" gutterBottom>
        Shopify Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter your Shopify store credentials. You'll need an Admin API access token with product write permissions.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Shop Name"
          placeholder="your-store"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          fullWidth
          helperText="Enter only the store name (e.g., 'my-store' not 'my-store.myshopify.com')"
        />
        <TextField
          label="Access Token"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          fullWidth
          helperText="Admin API access token from Shopify admin"
        />
        <Button
          variant="contained"
          onClick={handleTestConnection}
          disabled={!shopName || !accessToken || testing}
          sx={{ minWidth: '150px', height: '56px' }}
        >
          {testing ? <CircularProgress size={24} /> : 'Test Connection'}
        </Button>
      </Box>

      <Collapse in={testResult !== null}>
        {testResult && (
          <Alert
            severity={testResult.success ? 'success' : 'error'}
            icon={testResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
          >
            {testResult.message}
          </Alert>
        )}
      </Collapse>
    </Box>
  );
}

export default ShopifyConfig;
