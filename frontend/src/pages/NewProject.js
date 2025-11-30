import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, TextField, Button, Typography, Box,
  Radio, RadioGroup, FormControlLabel, FormControl, FormLabel,
  IconButton, List, ListItem, ListItemText, ListItemSecondaryAction,
  Stepper, Step, StepLabel, CircularProgress, Divider
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon,
  ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon,
  AutoAwesome as SparkleIcon
} from '@mui/icons-material';
import { useSnackbar } from '../contexts/SnackbarContext';
import api from '../config/api';

const steps = ['Project Details', 'Topic & Structure', 'Review & Create'];

function NewProject() {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  
  // Form Data
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('docx');
  const [topic, setTopic] = useState('');
  const [items, setItems] = useState([]); // Shared state for Outline or Slides
  const [newItemTitle, setNewItemTitle] = useState('');

  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const handleAddSection = () => {
    if (!newItemTitle.trim()) return;
    setItems([...items, {
      id: `temp_${Date.now()}`,
      title: newItemTitle.trim(),
      order: items.length
    }]);
    setNewItemTitle('');
  };

  const handleDeleteItem = (indexToDelete) => {
    const updated = items.filter((_, idx) => idx !== indexToDelete);
    setItems(updated.map((item, idx) => ({ ...item, order: idx })));
  };

  const handleMoveItem = (index, direction) => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === items.length - 1)) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...items];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setItems(updated.map((item, idx) => ({ ...item, order: idx })));
  };

  const handleGenerateTemplate = async () => {
    if (!topic.trim()) {
      showSnackbar('Please enter a topic first', 'warning');
      return;
    }
    try {
      setGeneratingTemplate(true);
      // Create temp project just to hit the endpoint
      const tempProject = { name: 'temp', document_type: documentType, topic: topic };
      const projRes = await api.post('/api/projects/', tempProject);
      const projectId = projRes.data.id;
      
      const templateRes = await api.post(`/api/documents/${projectId}/generate-template`);
      // Cleanup temp project
      api.delete(`/api/projects/${projectId}`); // Fire and forget cleanup

      const template = templateRes.data.template;
      setItems(template.map((t, i) => ({ id: `ai_${i}`, title: t.title, order: i })));
      showSnackbar('Template generated successfully!');
    } catch (err) {
      showSnackbar('Failed to generate template', 'error');
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleCreateProject = async () => {
    if (!name.trim()) return showSnackbar('Project name is required', 'error');
    if (items.length === 0) return showSnackbar(`Please add at least one ${documentType === 'docx' ? 'section' : 'slide'}`, 'error');

    try {
      setLoading(true);
      const projectData = {
        name: name.trim(),
        document_type: documentType,
        topic: topic.trim(),
        outline: documentType === 'docx' ? items : undefined,
        slides: documentType === 'pptx' ? items : undefined,
      };
      const response = await api.post('/api/projects/', projectData);
      showSnackbar('Project created successfully!');
      navigate(`/project/${response.data.id}`);
    } catch (err) {
      showSnackbar('Failed to create project', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && !name.trim()) return showSnackbar('Please enter a project name', 'warning');
    if (activeStep === 1 && !topic.trim()) return showSnackbar('Please enter a topic', 'warning');
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  // Render Step Content
  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth label="Project Name" value={name} onChange={(e) => setName(e.target.value)}
              margin="normal" autoFocus required placeholder="My Awesome Project"
            />
            <FormControl component="fieldset" sx={{ mt: 3, width: '100%' }}>
              <FormLabel component="legend">Document Type</FormLabel>
              <RadioGroup row value={documentType} onChange={(e) => { setDocumentType(e.target.value); setItems([]); }}>
                <Paper variant="outlined" sx={{ p: 2, mr: 2, display: 'flex', alignItems: 'center', cursor: 'pointer', borderColor: documentType === 'docx' ? 'primary.main' : 'divider' }}>
                  <FormControlLabel value="docx" control={<Radio />} label="Word Document (.docx)" />
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', cursor: 'pointer', borderColor: documentType === 'pptx' ? 'primary.main' : 'divider' }}>
                  <FormControlLabel value="pptx" control={<Radio />} label="PowerPoint (.pptx)" />
                </Paper>
              </RadioGroup>
            </FormControl>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth label="Main Topic" value={topic} onChange={(e) => setTopic(e.target.value)}
              margin="normal" placeholder="e.g. Market Analysis of Electric Vehicles" multiline rows={2}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, mb: 2 }}>
              <Typography variant="h6">{documentType === 'docx' ? 'Outline Structure' : 'Presentation Slides'}</Typography>
              <Button
                variant="contained" color="secondary" size="small"
                startIcon={generatingTemplate ? <CircularProgress size={16} color="inherit" /> : <SparkleIcon />}
                onClick={handleGenerateTemplate} disabled={generatingTemplate || !topic.trim()}
              >
                AI Suggest Structure
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth size="small" placeholder={`New ${documentType === 'docx' ? 'section' : 'slide'} title`}
                value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddSection()}
              />
              <Button variant="contained" onClick={handleAddSection} startIcon={<AddIcon />}>Add</Button>
            </Box>
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <List dense>
                {items.length === 0 ? (
                  <ListItem><ListItemText primary="No items yet. Add manually or use AI." sx={{ color: 'text.secondary', textAlign: 'center' }} /></ListItem>
                ) : items.map((item, index) => (
                  <ListItem key={index} divider={index !== items.length - 1}>
                    <ListItemText primary={`${index + 1}. ${item.title}`} />
                    <ListItemSecondaryAction>
                      <IconButton size="small" onClick={() => handleMoveItem(index, 'up')} disabled={index === 0}><ArrowUpIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => handleMoveItem(index, 'down')} disabled={index === items.length - 1}><ArrowDownIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteItem(index)}><DeleteIcon fontSize="small" /></IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>Ready to Create?</Typography>
            <Typography color="text.secondary" paragraph>
              You are creating a <strong>{documentType.toUpperCase()}</strong> about <strong>"{topic}"</strong> with <strong>{items.length}</strong> {documentType === 'docx' ? 'sections' : 'slides'}.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button size="large" variant="contained" onClick={handleCreateProject} disabled={loading} sx={{ minWidth: 200 }}>
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Project'}
              </Button>
            </Box>
          </Box>
        );
      default: return 'Unknown step';
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f3f4f6', py: 4 }}>
      <Container maxWidth="md">
        <Button onClick={() => navigate('/dashboard')} sx={{ mb: 2 }}>Back to Dashboard</Button>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>New Project</Typography>
          <Stepper activeStep={activeStep} sx={{ py: 3 }}>
            {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>
          <Box sx={{ minHeight: 400 }}>
            {renderStepContent(activeStep)}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button disabled={activeStep === 0} onClick={handleBack}>Back</Button>
            {activeStep < steps.length - 1 && (
              <Button variant="contained" onClick={handleNext}>Next</Button>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default NewProject;