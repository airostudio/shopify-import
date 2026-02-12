import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

function CSVImport({ shopifyConfig, onImportStart, onProgressUpdate, isImporting }) {
  const [file, setFile] = useState(null);
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

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false,
    disabled: isImporting
  });

  const handleImport = async () => {
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    if (!shopifyConfig.shopName || !shopifyConfig.accessToken) {
      setError('Please configure Shopify connection first');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientId', clientId);
      formData.append('shopifyConfig', JSON.stringify(shopifyConfig));

      const response = await axios.post('/api/import/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        onImportStart(response.data.jobId);
      }
    } catch (error) {
      setError(error.response?.data?.error || error.message);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Import from CSV File
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload a CSV file in Shopify format. Maximum file size: 15MB.
      </Typography>

      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          cursor: isImporting ? 'not-allowed' : 'pointer',
          textAlign: 'center',
          transition: 'all 0.3s',
          '&:hover': {
            borderColor: isImporting ? 'grey.300' : 'primary.main',
            bgcolor: isImporting ? 'background.paper' : 'action.hover'
          }
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {isDragActive ? 'Drop the CSV file here' : 'Drag & drop a CSV file here'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          or click to browse files
        </Typography>
      </Paper>

      {file && (
        <Paper sx={{ mt: 2, p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Selected File:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <DescriptionIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={file.name}
                secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
              />
            </ListItem>
          </List>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleImport}
          disabled={!file || isImporting}
          fullWidth
        >
          {isImporting ? 'Importing...' : 'Start Import'}
        </Button>
        {file && !isImporting && (
          <Button
            variant="outlined"
            size="large"
            onClick={() => setFile(null)}
          >
            Clear
          </Button>
        )}
      </Box>

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2" fontWeight="bold" gutterBottom>
          CSV Format Requirements:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>UTF-8 encoding required</li>
            <li>Must include "Title" column</li>
            <li>Maximum file size: 15MB</li>
            <li>See Shopify's CSV template for all available columns</li>
          </ul>
        </Typography>
      </Alert>
    </Box>
  );
}

export default CSVImport;
