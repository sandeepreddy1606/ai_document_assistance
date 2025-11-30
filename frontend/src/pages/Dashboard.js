import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Button, Box, Card, CardContent, CardActions,
  Grid, IconButton, AppBar, Toolbar, CircularProgress, Chip, Menu, MenuItem,
  Avatar, Tooltip
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Article as ArticleIcon,
  Slideshow as SlideshowIcon, MoreVert as MoreVertIcon, Logout as LogoutIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import api from '../config/api';

function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, logout } = useAuth();
  const { showSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const response = await api.get('/api/projects/');
      setProjects(response.data);
    } catch (err) {
      showSnackbar('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(projectId) {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.delete(`/api/projects/${projectId}`);
      showSnackbar('Project deleted successfully');
      fetchProjects();
    } catch (err) {
      showSnackbar('Failed to delete project', 'error');
    }
  }

  const handleMenu = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      showSnackbar('Failed to logout', 'error');
    }
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f3f4f6' }}>
      <AppBar position="static" color="default" elevation={1} sx={{ bgcolor: 'white' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'primary.main', fontWeight: 'bold' }}>
            AI Document Assistant
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {currentUser?.email}
            </Typography>
            <IconButton onClick={handleMenu} color="primary">
              <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>{currentUser?.email?.[0]?.toUpperCase()}</Avatar>
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
              <MenuItem onClick={handleLogout}>
                <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 6, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 800, color: '#111827' }}>
              Your Projects
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and generate your documents and presentations.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => navigate('/project/new')}
            sx={{ px: 4, py: 1.5, borderRadius: 50 }}
          >
            Create New
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        ) : projects.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 8, p: 6, bgcolor: 'white', borderRadius: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              You don't have any projects yet.
            </Typography>
            <Button variant="outlined" onClick={() => navigate('/project/new')} sx={{ mt: 2 }}>
              Get Started
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {projects.map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project.id}>
                <Card sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
                }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                      <Chip 
                        icon={project.document_type === 'docx' ? <ArticleIcon /> : <SlideshowIcon />}
                        label={project.document_type === 'docx' ? "Word Doc" : "PowerPoint"} 
                        color={project.document_type === 'docx' ? "primary" : "secondary"} 
                        size="small"
                        variant="soft" // Note: soft variant requires custom theme or MUI v6, fallback to default
                      />
                      <IconButton size="small" onClick={() => handleDelete(project.id)}>
                        <DeleteIcon fontSize="small" color="action" />
                      </IconButton>
                    </Box>
                    <Typography variant="h6" component="h2" gutterBottom noWrap sx={{ fontWeight: 600 }}>
                      {project.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ 
                      mb: 2, 
                      display: '-webkit-box', 
                      WebkitLineClamp: 2, 
                      WebkitBoxOrient: 'vertical', 
                      overflow: 'hidden',
                      height: '40px'
                    }}>
                      {project.topic}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Updated {new Date(project.updated_at).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button 
                      fullWidth 
                      variant="outlined" 
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      Open Editor
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}

export default Dashboard;