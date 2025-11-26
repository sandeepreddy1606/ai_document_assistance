import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';

function NewProject() {
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('docx');
  const [topic, setTopic] = useState('');
  const [outline, setOutline] = useState([]);
  const [slides, setSlides] = useState([]);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleAddSection = () => {
    if (!newSectionTitle.trim()) return;

    const newItem = {
      id: `item_${Date.now()}`,
      title: newSectionTitle.trim(),
      order: documentType === 'docx' ? outline.length : slides.length,
    };

    if (documentType === 'docx') {
      setOutline([...outline, newItem]);
    } else {
      setSlides([...slides, newItem]);
    }

    setNewSectionTitle('');
  };

  const handleDeleteItem = (id) => {
    if (documentType === 'docx') {
      const updated = outline.filter((item) => item.id !== id);
      setOutline(updated.map((item, index) => ({ ...item, order: index })));
    } else {
      const updated = slides.filter((item) => item.id !== id);
      setSlides(updated.map((item, index) => ({ ...item, order: index })));
    }
  };

  const handleMoveItem = (id, direction) => {
    if (documentType === 'docx') {
      const index = outline.findIndex((item) => item.id === id);
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === outline.length - 1)
      ) {
        return;
      }
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      const updated = [...outline];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      setOutline(updated.map((item, i) => ({ ...item, order: i })));
    } else {
      const index = slides.findIndex((item) => item.id === id);
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === slides.length - 1)
      ) {
        return;
      }
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      const updated = [...slides];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      setSlides(updated.map((item, i) => ({ ...item, order: i })));
    }
  };

  const handleGenerateTemplate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic first');
      return;
    }

    try {
      setGeneratingTemplate(true);
      setError('');
      
      // Create a temporary project to generate template
      const tempProject = {
        name: 'temp',
        document_type: documentType,
        topic: topic,
      };
      
      const projectResponse = await api.post('/api/projects/', tempProject);
      const projectId = projectResponse.data.id;
      
      const templateResponse = await api.post(`/api/documents/${projectId}/generate-template`);
      const template = templateResponse.data.template;
      
      // Delete temp project
      await api.delete(`/api/projects/${projectId}`);
      
      if (documentType === 'docx') {
        setOutline(template.map((item, index) => ({ ...item, id: `item_${Date.now()}_${index}`, order: index })));
      } else {
        setSlides(template.map((item, index) => ({ ...item, id: `item_${Date.now()}_${index}`, order: index })));
      }
    } catch (err) {
      setError('Failed to generate template: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !topic.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (documentType === 'docx' && outline.length === 0) {
      setError('Please add at least one section to the outline');
      return;
    }

    if (documentType === 'pptx' && slides.length === 0) {
      setError('Please add at least one slide');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const projectData = {
        name: name.trim(),
        document_type: documentType,
        topic: topic.trim(),
        outline: documentType === 'docx' ? outline : undefined,
        slides: documentType === 'pptx' ? slides : undefined,
      };

      const response = await api.post('/api/projects/', projectData);
      navigate(`/project/${response.data.id}`);
    } catch (err) {
      setError('Failed to create project: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const items = documentType === 'docx' ? outline : slides;

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            New Project
          </Typography>
          <Button color="inherit" onClick={() => navigate('/dashboard')}>
            Cancel
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ padding: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Create New Project
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="name"
              label="Project Name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <FormControl component="fieldset" sx={{ mt: 2, mb: 2 }}>
              <FormLabel component="legend">Document Type</FormLabel>
              <RadioGroup
                row
                value={documentType}
                onChange={(e) => {
                  setDocumentType(e.target.value);
                  setOutline([]);
                  setSlides([]);
                }}
              >
                <FormControlLabel value="docx" control={<Radio />} label="Word Document (.docx)" />
                <FormControlLabel value="pptx" control={<Radio />} label="PowerPoint (.pptx)" />
              </RadioGroup>
            </FormControl>

            <TextField
              margin="normal"
              required
              fullWidth
              id="topic"
              label="Main Topic"
              name="topic"
              placeholder="e.g., A market analysis of the EV industry in 2025"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />

            <Box sx={{ mt: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  {documentType === 'docx' ? 'Document Outline' : 'Slides'}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleGenerateTemplate}
                  disabled={generatingTemplate || !topic.trim()}
                >
                  {generatingTemplate ? <CircularProgress size={20} /> : 'AI-Suggest Template'}
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={`Enter ${documentType === 'docx' ? 'section title' : 'slide title'}`}
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSection();
                    }
                  }}
                />
                <Button variant="contained" onClick={handleAddSection} startIcon={<AddIcon />}>
                  Add
                </Button>
              </Box>

              <List>
                {items.map((item, index) => (
                  <ListItem key={item.id}>
                    <ListItemText
                      primary={`${index + 1}. ${item.title}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleMoveItem(item.id, 'up')}
                        disabled={index === 0}
                        size="small"
                      >
                        <ArrowUpIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleMoveItem(item.id, 'down')}
                        disabled={index === items.length - 1}
                        size="small"
                      >
                        <ArrowDownIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteItem(item.id)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/dashboard')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Create Project'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </>
  );
}

export default NewProject;

