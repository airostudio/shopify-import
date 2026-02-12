import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  CircularProgress,
  Collapse
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import StoreIcon from '@mui/icons-material/Store';
import axios from 'axios';

function WooCommerceImport({ shopifyConfig, onImportStart, onProgressUpdate, isImporting }) {
  const [wooConfig, setWooConfig] = useState({
    url: '',
    consumerKey: '',
    consumerSecret: ''
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [clientId] = useState(() => `client-${Date.now()}`);
  const wsRef = useRef(null);

  // Setup WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3001?clientId=${clientId}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onProgressUpdate(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    wsRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [clientId, onProgressUpdate]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await axios.post('/api/test/woocommerce', wooConfig);

      setTestResult({
        success: response.data.success,
        message: response.data.message
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.error || error.message
      });
    } finally {
      setTesting(false);
    }
  };

  const handleImport = async () => {
    if (!wooConfig.url || !wooConfig.consumerKey || !wooConfig.consumerSecret) {
      setError('Please fill in all WooCommerce credentials');
      return;
    }

    if (!shopifyConfig.shopName || !shopifyConfig.accessToken) {
      setError('Please configure Shopify connection first');
      return;
    }

    if (!testResult || !testResult.success) {
      setError('Please test WooCommerce connection first');
      return;
    }

    try {
      const response = await axios.post('/api/import/woocommerce', {
        clientId,
        wooConfig,
        shopifyConfig
      });

      if (response.data.success) {
        onImportStart(response.data.jobId);
        setError(null);
      }
    } catch (error) {
      setError(error.response?.data?.error || error.message);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Import from WooCommerce Store
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Connect to your WooCommerce store and import all products with variations.
      </Typography>

      <Paper sx={{ p: 3, mb: 3, bgcolor: '#f5f5f5' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <StoreIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle1" fontWeight="bold">
            WooCommerce Store Credentials
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Store URL"
            placeholder="https://yourstore.com"
            value={wooConfig.url}
            onChange={(e) => setWooConfig({ ...wooConfig, url: e.target.value })}
            fullWidth
            helperText="Your WooCommerce store URL (e.g., https://example.com)"
          />
          <TextField
            label="Consumer Key"
            value={wooConfig.consumerKey}
            onChange={(e) => setWooConfig({ ...wooConfig, consumerKey: e.target.value })}
            fullWidth
            helperText="WooCommerce REST API consumer key"
          />
          <TextField
            label="Consumer Secret"
            type="password"
            value={wooConfig.consumerSecret}
            onChange={(e) => setWooConfig({ ...wooConfig, consumerSecret: e.target.value })}
            fullWidth
            helperText="WooCommerce REST API consumer secret"
          />

          <Button
            variant="outlined"
            onClick={handleTestConnection}
            disabled={!wooConfig.url || !wooConfig.consumerKey || !wooConfig.consumerSecret || testing}
            startIcon={testing ? <CircularProgress size={20} /> : null}
          >
            {testing ? 'Testing Connection...' : 'Test WooCommerce Connection'}
          </Button>

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
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        size="large"
        onClick={handleImport}
        disabled={!testResult?.success || isImporting}
        fullWidth
      >
        {isImporting ? 'Importing...' : 'Start WooCommerce Import'}
      </Button>

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2" fontWeight="bold" gutterBottom>
          How to get WooCommerce API credentials:
        </Typography>
        <Typography variant="body2" component="div">
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Go to WooCommerce → Settings → Advanced → REST API</li>
            <li>Click "Add key"</li>
            <li>Set permissions to "Read"</li>
            <li>Click "Generate API key"</li>
            <li>Copy the Consumer Key and Consumer Secret</li>
          </ol>
        </Typography>
      </Alert>
    </Box>
  );
}

export default WooCommerceImport;
