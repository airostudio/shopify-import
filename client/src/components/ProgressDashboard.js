import React from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InventoryIcon from '@mui/icons-material/Inventory';
import SpeedIcon from '@mui/icons-material/Speed';

function ProgressDashboard({ progress }) {
  const getStatusColor = (status) => {
    const statusMap = {
      'started': 'info',
      'parsing': 'info',
      'parsed': 'success',
      'connecting': 'info',
      'fetching': 'info',
      'fetched': 'success',
      'importing': 'warning',
      'completed': 'success',
      'failed': 'error'
    };
    return statusMap[progress.status] || 'default';
  };

  const getStatusIcon = () => {
    if (progress.type === 'complete') {
      return <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main' }} />;
    } else if (progress.type === 'error') {
      return <ErrorIcon sx={{ fontSize: 40, color: 'error.main' }} />;
    } else {
      return <HourglassEmptyIcon sx={{ fontSize: 40, color: 'info.main' }} />;
    }
  };

  return (
    <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: 3, bgcolor: 'primary.main', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {getStatusIcon()}
            <Box>
              <Typography variant="h5" fontWeight="bold">
                Import Progress
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Job ID: {progress.jobId}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={progress.status.toUpperCase()}
            color={getStatusColor(progress.status)}
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
      </Box>

      <Box sx={{ p: 3 }}>
        {/* Progress Bar */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body1" fontWeight="medium">
              {progress.message}
            </Typography>
            <Typography variant="body1" fontWeight="bold" color="primary">
              {Math.round(progress.progress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress.progress}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                borderRadius: 5,
                bgcolor: progress.type === 'error' ? 'error.main' : 'primary.main'
              }
            }}
          />
        </Box>

        {/* Details Cards */}
        {progress.data && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {progress.data.totalProducts !== undefined && (
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <InventoryIcon color="primary" />
                      <Typography variant="subtitle2" color="text.secondary">
                        Total Products
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold">
                      {progress.data.totalProducts.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {progress.data.totalBatches !== undefined && (
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CloudUploadIcon color="primary" />
                      <Typography variant="subtitle2" color="text.secondary">
                        Batches
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold">
                      {progress.data.completedBatches || 0} / {progress.data.totalBatches}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {progress.data.currentPage !== undefined && (
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <SpeedIcon color="primary" />
                      <Typography variant="subtitle2" color="text.secondary">
                        Current Page
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold">
                      {progress.data.currentPage} / {progress.data.totalPages}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {progress.data.objectCount !== undefined && (
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CheckCircleIcon color="success" />
                      <Typography variant="subtitle2" color="text.secondary">
                        Objects Processed
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold">
                      {progress.data.objectCount.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}

        {/* Status Messages */}
        {progress.type === 'complete' && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            <Typography variant="body1" fontWeight="bold">
              Import Completed Successfully!
            </Typography>
            <Typography variant="body2">
              {progress.message}
            </Typography>
          </Alert>
        )}

        {progress.type === 'error' && (
          <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
            <Typography variant="body1" fontWeight="bold">
              Import Failed
            </Typography>
            <Typography variant="body2">
              {progress.message}
            </Typography>
            {progress.error && (
              <Typography variant="caption" component="pre" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                {progress.error}
              </Typography>
            )}
          </Alert>
        )}

        {/* Detailed Activity Log */}
        {progress.data && Object.keys(progress.data).length > 0 && (
          <Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Detailed Information
            </Typography>
            <List dense>
              {Object.entries(progress.data).map(([key, value]) => {
                // Skip if value is undefined or null
                if (value === undefined || value === null) return null;

                // Format key for display
                const displayKey = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .trim();

                // Format value for display
                let displayValue = value;
                if (typeof value === 'object') {
                  displayValue = JSON.stringify(value, null, 2);
                } else if (typeof value === 'number') {
                  displayValue = value.toLocaleString();
                }

                return (
                  <ListItem key={key}>
                    <ListItemText
                      primary={displayKey}
                      secondary={displayValue}
                      primaryTypographyProps={{ fontWeight: 'medium' }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default ProgressDashboard;
