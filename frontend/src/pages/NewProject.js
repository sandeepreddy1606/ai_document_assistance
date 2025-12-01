import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
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
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Divider,
} from '@mui/material';

import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  AutoAwesome as SparkleIcon,
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

  // Shared: sections / slides list
  const [items, setItems] = useState([]);
  const [newItemTitle, setNewItemTitle] = useState('');

  // PPTX only: user-requested number of slides (required)
  const [slideCount, setSlideCount] = useState('');

  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  // ---------- List helpers (sections/slides) ----------

  const handleAddItem = () => {
    if (!newItemTitle.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        id: `temp_${Date.now()}`,
        title: newItemTitle.trim(),
        order: prev.length,
      },
    ]);
    setNewItemTitle('');
  };

  const handleDeleteItem = (indexToDelete) => {
    const updated = items.filter((_, idx) => idx !== indexToDelete);
    setItems(
      updated.map((item, idx) => ({
        ...item,
        order: idx,
      })),
    );
  };

  const handleMoveItem = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === items.length - 1)
    ) {
      return;
    }
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...items];
    [updated[index], updated[newIndex]] = [
      updated[newIndex],
      updated[index],
    ];
    setItems(
      updated.map((item, idx) => ({
        ...item,
        order: idx,
      })),
    );
  };

  // ---------- AI template generation ----------

  const handleGenerateTemplate = async () => {
    if (!topic.trim()) {
      showSnackbar('Please enter a topic first', 'warning');
      return;
    }

    let requestedSlides = null;

    if (documentType === 'pptx') {
      const n = parseInt(slideCount, 10);
      if (Number.isNaN(n) || n <= 0) {
        showSnackbar(
          'Please enter a valid number of slides (e.g., 10)',
          'warning',
        );
        return;
      }
      requestedSlides = n;
    }

    try {
      setGeneratingTemplate(true);

      // Build topic hint for AI when pptx
      const topicForAI =
        documentType === 'pptx' && requestedSlides
          ? `${topic.trim()} (create outline for exactly ${requestedSlides} slides)`
          : topic.trim();

      // Create a temporary project just to call the backend template endpoint
      const tempProject = {
        name: 'temp',
        document_type: documentType,
        topic: topicForAI,
      };

      const projRes = await api.post('/api/projects/', tempProject);
      const projectId = projRes.data.id;

      const templateRes = await api.post(
        `/api/documents/${projectId}/generate-template`,
      );

      // Fire-and-forget delete of temp project
      api.delete(`/api/projects/${projectId}`).catch(() => {});

      let template = templateRes.data.template || [];

      // Normalise template entries
      let normalised = template.map((t, i) => ({
        id: `ai_${i}`,
        title: t.title || t || `Item ${i + 1}`,
        order: i,
      }));

      // IMPORTANT: do NOT "force" extra fake slides.
      // If AI returns more titles than requested → keep only the first N.
      // If fewer → just keep them; user can add more manually.
      if (documentType === 'pptx' && requestedSlides) {
        if (normalised.length > requestedSlides) {
          normalised = normalised.slice(0, requestedSlides);
        } else if (normalised.length < requestedSlides) {
          showSnackbar(
            `AI returned ${normalised.length} slide titles for requested ${requestedSlides}. You can add or edit slides manually.`,
            'info',
          );
        }
      }

      setItems(normalised);
      showSnackbar('Template generated successfully!');
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to generate template', 'error');
    } finally {
      setGeneratingTemplate(false);
    }
  };

  // ---------- Create project ----------

  const handleCreateProject = async () => {
    if (!name.trim()) {
      showSnackbar('Project name is required', 'error');
      return;
    }
    if (!topic.trim()) {
      showSnackbar('Topic / main prompt is required', 'error');
      return;
    }
    if (documentType === 'pptx') {
      const n = parseInt(slideCount, 10);
      if (Number.isNaN(n) || n <= 0) {
        showSnackbar(
          'Number of slides is required for a PPT project',
          'error',
        );
        return;
      }
    }
    if (items.length === 0) {
      showSnackbar(
        `Please add at least one ${
          documentType === 'docx' ? 'section' : 'slide'
        }`,
        'error',
      );
      return;
    }

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
      console.error(err);
      showSnackbar('Failed to create project', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Stepper navigation ----------

  const handleNext = () => {
    if (activeStep === 0 && !name.trim()) {
      showSnackbar('Please enter a project name', 'warning');
      return;
    }
    if (activeStep === 1) {
      if (!topic.trim()) {
        showSnackbar('Please enter a main topic / prompt', 'warning');
        return;
      }
      if (documentType === 'pptx') {
        const n = parseInt(slideCount, 10);
        if (Number.isNaN(n) || n <= 0) {
          showSnackbar(
            'Number of slides is required (e.g., 10)',
            'warning',
          );
          return;
        }
      }
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  // ---------- Render per-step content ----------

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 3 }}>
            <TextField
              label="Project Name"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              margin="normal"
              autoFocus
              required
              placeholder="My Awesome Project"
            />

            <FormControl component="fieldset" sx={{ mt: 2 }}>
              <FormLabel component="legend">Document Type</FormLabel>
              <RadioGroup
                row
                value={documentType}
                onChange={(e) => {
                  setDocumentType(e.target.value);
                  // reset structure & slide count when switching type
                  setItems([]);
                  setSlideCount('');
                }}
              >
                <FormControlLabel
                  value="docx"
                  control={<Radio />}
                  label="Word Document (.docx)"
                />
                <FormControlLabel
                  value="pptx"
                  control={<Radio />}
                  label="PowerPoint (.pptx)"
                />
              </RadioGroup>
            </FormControl>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ mt: 3 }}>
            {/* Main topic / prompt */}
            <TextField
              label="Main topic / prompt"
              fullWidth
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              margin="normal"
              placeholder="e.g., A market analysis of the EV industry in 2025"
              multiline
              rows={2}
            />

            {/* PPTX: required number of slides input */}
            {documentType === 'pptx' && (
              <Box sx={{ mt: 2, mb: 1 }}>
                <TextField
                  label="Number of slides (required)"
                  type="number"
                  value={slideCount}
                  onChange={(e) => setSlideCount(e.target.value)}
                  inputProps={{ min: 1 }}
                  fullWidth
                />
              </Box>
            )}

            <Box
              sx={{
                mt: 3,
                mb: 1,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="subtitle1" fontWeight={600}>
                {documentType === 'docx'
                  ? 'Outline structure (sections)'
                  : 'Presentation slides (titles)'}
              </Typography>

              <Button
                variant="outlined"
                size="small"
                startIcon={
                  generatingTemplate ? (
                    <CircularProgress size={14} />
                  ) : (
                    <SparkleIcon />
                  )
                }
                onClick={handleGenerateTemplate}
                disabled={generatingTemplate || !topic.trim()}
              >
                AI Suggest Structure
              </Button>
            </Box>

            {/* Manual add / reorder / delete */}
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
                mt: 1,
                mb: 2,
              }}
            >
              <TextField
                label={
                  documentType === 'docx'
                    ? 'Section title'
                    : 'Slide title'
                }
                fullWidth
                size="small"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddItem}
              >
                Add
              </Button>
            </Box>

            {items.length === 0 ? (
              <Typography color="text.secondary">
                No {documentType === 'docx' ? 'sections' : 'slides'} yet.
                Use AI Suggest Structure or add them manually.
              </Typography>
            ) : (
              <Paper variant="outlined">
                <List dense>
                  {items.map((item, index) => (
                    <ListItem key={item.id}>
                      <ListItemText
                        primary={`${index + 1}. ${item.title}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleMoveItem(index, 'up')}
                          disabled={index === 0}
                          size="small"
                        >
                          <ArrowUpIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          edge="end"
                          onClick={() =>
                            handleMoveItem(index, 'down')
                          }
                          disabled={index === items.length - 1}
                          size="small"
                        >
                          <ArrowDownIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteItem(index)}
                          size="small"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        );

      case 2:
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Ready to create?
            </Typography>
            <Typography sx={{ mb: 1.5 }}>
              You are creating a{' '}
              <strong>{documentType.toUpperCase()}</strong> about{' '}
              <strong>"{topic}"</strong>{' '}
              {documentType === 'pptx' && slideCount && (
                <>
                  with <strong>{slideCount}</strong> slides,
                </>
              )}{' '}
              currently defined as{' '}
              <strong>
                {items.length}{' '}
                {documentType === 'docx' ? 'sections' : 'slides'}
              </strong>
              .
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Structure preview
            </Typography>
            <List dense>
              {items.map((item, idx) => (
                <ListItem key={item.id}>
                  <ListItemText
                    primary={`${idx + 1}. ${item.title}`}
                  />
                </ListItem>
              ))}
            </List>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleCreateProject}
                disabled={loading}
                startIcon={
                  loading ? <CircularProgress size={18} /> : null
                }
              >
                {loading ? 'Creating...' : 'Create Project'}
              </Button>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  // ---------- Render ----------

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 2 }}
        variant="text"
      >
        Back to Dashboard
      </Button>

      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          New Project
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mt: 2, mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent(activeStep)}

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 4,
          }}
        >
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            variant="outlined"
          >
            Back
          </Button>
          {activeStep < steps.length - 1 && (
            <Button onClick={handleNext} variant="contained">
              Next
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

export default NewProject;
