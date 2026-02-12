import React, { useState } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  Tabs,
  Tab,
  ThemeProvider,
  createTheme,
  CssBaseline
} from '@mui/material';
import CSVImport from './components/CSVImport';
import WooCommerceImport from './components/WooCommerceImport';
import ShopifyConfig from './components/ShopifyConfig';
import ProgressDashboard from './components/ProgressDashboard';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
  },
});

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`import-tabpanel-${index}`}
      aria-labelledby={`import-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);
  const [shopifyConfig, setShopifyConfig] = useState({
    shopName: '',
    accessToken: ''
  });
  const [importProgress, setImportProgress] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleShopifyConfigChange = (config) => {
    setShopifyConfig(config);
  };

  const handleImportStart = (jobId) => {
    setIsImporting(true);
    setImportProgress({
      jobId,
      status: 'started',
      progress: 0,
      message: 'Import started...'
    });
  };

  const handleProgressUpdate = (progressData) => {
    setImportProgress(progressData);

    if (progressData.type === 'complete' || progressData.type === 'error') {
      setIsImporting(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="App">
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h3" component="h1" gutterBottom sx={{ color: 'white', fontWeight: 'bold' }}>
              Shopify Import Tool
            </Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              Import products from WooCommerce or CSV to Shopify
            </Typography>
          </Box>

          <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <ShopifyConfig
              config={shopifyConfig}
              onChange={handleShopifyConfigChange}
            />

            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="import tabs"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="CSV Import" />
              <Tab label="WooCommerce Import" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              <CSVImport
                shopifyConfig={shopifyConfig}
                onImportStart={handleImportStart}
                onProgressUpdate={handleProgressUpdate}
                isImporting={isImporting}
              />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <WooCommerceImport
                shopifyConfig={shopifyConfig}
                onImportStart={handleImportStart}
                onProgressUpdate={handleProgressUpdate}
                isImporting={isImporting}
              />
            </TabPanel>
          </Paper>

          {importProgress && (
            <Box sx={{ mt: 3 }}>
              <ProgressDashboard progress={importProgress} />
            </Box>
          )}
        </Container>
      </div>
    </ThemeProvider>
  );
}

export default App;
