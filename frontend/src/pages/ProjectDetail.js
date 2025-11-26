import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  TextField,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Comment as CommentIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../config/api';

function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState({});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [refinementPrompts, setRefinementPrompts] = useState({});
  const [comments, setComments] = useState({});
  const [commentDialog, setCommentDialog] = useState({ open: false, sectionId: null });

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  async function fetchProject() {
    try {
      setLoading(true);
      const response = await api.get(`/api/projects/${projectId}`);
      setProject(response.data);
      
      // Initialize refinement prompts and comments
      const content = response.data.content || {};
      const prompts = {};
      const comms = {};
      Object.keys(content).forEach((key) => {
        prompts[key] = '';
        comms[key] = '';
      });
      setRefinementPrompts(prompts);
      setComments(comms);
    } catch (err) {
      setError('Failed to load project: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateContent() {
    try {
      setGenerating(true);
      setError('');
      await api.post(`/api/documents/${projectId}/generate-content`);
      await fetchProject();
    } catch (err) {
      setError('Failed to generate content: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefine(sectionId) {
    const prompt = refinementPrompts[sectionId];
    if (!prompt || !prompt.trim()) {
      setError('Please enter a refinement prompt');
      return;
    }

    try {
      setRefining({ ...refining, [sectionId]: true });
      setError('');
      await api.post(`/api/documents/${projectId}/refine`, {
        section_id: sectionId,
        prompt: prompt,
      });
      setRefinementPrompts({ ...refinementPrompts, [sectionId]: '' });
      await fetchProject();
    } catch (err) {
      setError('Failed to refine content: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRefining({ ...refining, [sectionId]: false });
    }
  }

  async function handleFeedback(sectionId, feedbackType) {
    try {
      await api.post(`/api/documents/${projectId}/feedback`, {
        section_id: sectionId,
        feedback_type: feedbackType,
      });
      await fetchProject();
    } catch (err) {
      setError('Failed to add feedback: ' + (err.response?.data?.detail || err.message));
    }
  }

  async function handleAddComment(sectionId) {
    const comment = comments[sectionId];
    if (!comment || !comment.trim()) {
      return;
    }

    try {
      await api.post(`/api/documents/${projectId}/comment`, {
        section_id: sectionId,
        comment: comment,
      });
      setComments({ ...comments, [sectionId]: '' });
      setCommentDialog({ open: false, sectionId: null });
      await fetchProject();
    } catch (err) {
      setError('Failed to add comment: ' + (err.response?.data?.detail || err.message));
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      setError('');
      const response = await api.get(`/api/documents/${projectId}/export`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${project.name}.${project.document_type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export document: ' + (err.response?.data?.detail || err.message));
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return (
      <Container>
        <Alert severity="error">Project not found</Alert>
      </Container>
    );
  }

  const content = project.content || {};
  const hasContent = Object.keys(content).length > 0;
  const items = project.document_type === 'docx' ? project.outline : project.slides;
  const sortedItems = [...(items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {project.name}
          </Typography>
          <Button
            color="inherit"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={exporting || !hasContent}
          >
            {exporting ? <CircularProgress size={20} color="inherit" /> : 'Export'}
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ padding: 4 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {project.name}
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              <strong>Type:</strong> {project.document_type.toUpperCase()}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              <strong>Topic:</strong> {project.topic}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {!hasContent ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" gutterBottom>
                No content generated yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Click the button below to generate content for all {project.document_type === 'docx' ? 'sections' : 'slides'}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleGenerateContent}
                disabled={generating}
                startIcon={generating ? <CircularProgress size={20} /> : <RefreshIcon />}
              >
                {generating ? 'Generating...' : 'Generate Content'}
              </Button>
            </Box>
          ) : (
            <>
              <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleGenerateContent}
                  disabled={generating}
                  startIcon={generating ? <CircularProgress size={20} /> : <RefreshIcon />}
                >
                  {generating ? 'Regenerating...' : 'Regenerate All Content'}
                </Button>
              </Box>

              {sortedItems.map((item, index) => {
                const sectionId = item.id || (project.document_type === 'docx' ? `section_${item.order}` : `slide_${item.order}`);
                const sectionContent = content[sectionId];
                const hasSectionContent = sectionContent && sectionContent.content;

                return (
                  <Accordion key={sectionId} defaultExpanded={index === 0} sx={{ mb: 2 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mr: 2 }}>
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                          {index + 1}. {item.title}
                        </Typography>
                        {hasSectionContent && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFeedback(sectionId, 'like');
                              }}
                            >
                              <ThumbUpIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFeedback(sectionId, 'dislike');
                              }}
                            >
                              <ThumbDownIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCommentDialog({ open: true, sectionId });
                              }}
                            >
                              <CommentIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      {hasSectionContent ? (
                        <Box>
                          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                            <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                              {sectionContent.content}
                            </Typography>
                          </Paper>

                          <Box sx={{ mb: 2 }}>
                            <TextField
                              fullWidth
                              multiline
                              rows={2}
                              label="Refinement Prompt"
                              placeholder="e.g., Make this more formal, Convert to bullet points, Shorten to 100 words"
                              value={refinementPrompts[sectionId] || ''}
                              onChange={(e) =>
                                setRefinementPrompts({
                                  ...refinementPrompts,
                                  [sectionId]: e.target.value,
                                })
                              }
                              sx={{ mb: 1 }}
                            />
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleRefine(sectionId)}
                              disabled={refining[sectionId] || !refinementPrompts[sectionId]?.trim()}
                            >
                              {refining[sectionId] ? (
                                <CircularProgress size={20} />
                              ) : (
                                'Refine with AI'
                              )}
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <Typography color="text.secondary">
                          Content not generated yet for this {project.document_type === 'docx' ? 'section' : 'slide'}
                        </Typography>
                      )}
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </>
          )}
        </Paper>
      </Container>

      <Dialog
        open={commentDialog.open}
        onClose={() => setCommentDialog({ open: false, sectionId: null })}
      >
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Comment"
            fullWidth
            multiline
            rows={4}
            value={comments[commentDialog.sectionId] || ''}
            onChange={(e) =>
              setComments({
                ...comments,
                [commentDialog.sectionId]: e.target.value,
              })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialog({ open: false, sectionId: null })}>
            Cancel
          </Button>
          <Button
            onClick={() => handleAddComment(commentDialog.sectionId)}
            variant="contained"
          >
            Add Comment
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ProjectDetail;

