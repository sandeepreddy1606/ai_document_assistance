import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Button, Box, TextField,
  CircularProgress, AppBar, Toolbar, IconButton, Accordion,
  AccordionSummary, AccordionDetails, ToggleButton, ToggleButtonGroup,
  Fab, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Fade
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon, ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon, Comment as CommentIcon,
  Refresh as RefreshIcon, Edit as EditIcon, Visibility as ViewIcon,
  NavigateNext as NextIcon, NavigateBefore as PrevIcon,
  AutoFixHigh as MagicIcon
} from '@mui/icons-material';
import api from '../config/api';
import { useSnackbar } from '../contexts/SnackbarContext';

function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  // State
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState({});
  const [exporting, setExporting] = useState(false);
  
  // UI State
  const [viewMode, setViewMode] = useState('editor'); // 'editor' or 'preview'
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  // Data State
  const [refinementPrompts, setRefinementPrompts] = useState({});
  const [comments, setComments] = useState({});
  const [commentDialog, setCommentDialog] = useState({ open: false, sectionId: null });

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  async function fetchProject() {
    try {
      const response = await api.get(`/api/projects/${projectId}`);
      setProject(response.data);
      // Initialize prompts
      const content = response.data.content || {};
      const prompts = {};
      Object.keys(content).forEach((key) => prompts[key] = '');
      setRefinementPrompts(prev => ({...prev, ...prompts}));
    } catch (err) {
      showSnackbar('Failed to load project', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateContent() {
    try {
      setGenerating(true);
      await api.post(`/api/documents/${projectId}/generate-content`);
      await fetchProject();
      setViewMode('preview'); // Auto-switch to preview to see results
      showSnackbar('Content generated successfully!');
    } catch (err) {
      showSnackbar('Failed to generate content', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefine(sectionId) {
    const prompt = refinementPrompts[sectionId];
    if (!prompt?.trim()) return showSnackbar('Enter a prompt first', 'warning');

    try {
      setRefining(prev => ({ ...prev, [sectionId]: true }));
      await api.post(`/api/documents/${projectId}/refine`, { section_id: sectionId, prompt });
      setRefinementPrompts(prev => ({ ...prev, [sectionId]: '' }));
      await fetchProject();
      showSnackbar('Section refined!');
    } catch (err) {
      showSnackbar('Refinement failed', 'error');
    } finally {
      setRefining(prev => ({ ...prev, [sectionId]: false }));
    }
  }

  async function handleFeedback(sectionId, type) {
    try {
      await api.post(`/api/documents/${projectId}/feedback`, { section_id: sectionId, feedback_type: type });
      // Ideally update local state optimistically, but re-fetching for now
      fetchProject(); 
    } catch (e) { console.error(e); }
  }

  async function handleExport() {
    try {
      setExporting(true);
      const response = await api.get(`/api/documents/${projectId}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${project.name}.${project.document_type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSnackbar('Download started!');
    } catch (err) {
      showSnackbar('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', height: '100vh', alignItems: 'center' }}><CircularProgress /></Box>;
  if (!project) return <Container sx={{ mt: 4 }}><Typography color="error">Project not found</Typography></Container>;

  const content = project.content || {};
  const hasContent = Object.keys(content).length > 0;
  const items = project.document_type === 'docx' ? project.outline : project.slides;
  const sortedItems = [...(items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <Box sx={{ bgcolor: '#f3f4f6', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <AppBar position="sticky" color="default" elevation={1} sx={{ bgcolor: 'white' }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold', color: '#111827' }}>
            {project.name}
          </Typography>
          
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newView) => newView && setViewMode(newView)}
            aria-label="view mode"
            size="small"
            sx={{ mr: 2 }}
          >
            <ToggleButton value="editor" aria-label="editor">
              <EditIcon sx={{ mr: 1 }} fontSize="small" /> Editor
            </ToggleButton>
            <ToggleButton value="preview" aria-label="preview">
              <ViewIcon sx={{ mr: 1 }} fontSize="small" /> Preview
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="contained"
            color="primary"
            startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
            onClick={handleExport}
            disabled={exporting || !hasContent}
          >
            Download
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth={viewMode === 'preview' ? 'lg' : 'md'} sx={{ flexGrow: 1, py: 4 }}>
        
        {/* EDITOR MODE */}
        {viewMode === 'editor' && (
          <Fade in={true}>
            <Box>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Topic</Typography>
                    <Typography variant="body1">{project.topic}</Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <MagicIcon />}
                    onClick={handleGenerateContent}
                    disabled={generating}
                  >
                    {hasContent ? 'Regenerate All' : 'Generate Content'}
                  </Button>
                </Box>
              </Paper>

              {sortedItems.map((item, index) => {
                const sectionId = item.id || (project.document_type === 'docx' ? `section_${item.order}` : `slide_${item.order}`);
                const sectionContent = content[sectionId];
                
                return (
                  <Accordion key={index} defaultExpanded={index === 0} sx={{ mb: 2, '&:before': { display: 'none' }, borderRadius: '8px !important' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{index + 1}. {item.title}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {sectionContent?.content ? (
                        <>
                          <TextField
                            fullWidth multiline minRows={3} maxRows={10}
                            value={sectionContent.content}
                            InputProps={{ readOnly: true }}
                            sx={{ bgcolor: '#f9fafb', mb: 2 }}
                          />
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField
                              fullWidth size="small"
                              placeholder="AI Refinement Instruction (e.g. 'Make it more persuasive')"
                              value={refinementPrompts[sectionId] || ''}
                              onChange={(e) => setRefinementPrompts(prev => ({...prev, [sectionId]: e.target.value}))}
                            />
                            <Button 
                              variant="outlined" 
                              onClick={() => handleRefine(sectionId)}
                              disabled={refining[sectionId] || !refinementPrompts[sectionId]}
                            >
                              {refining[sectionId] ? <CircularProgress size={20} /> : 'Refine'}
                            </Button>
                          </Box>
                          <Box sx={{ display: 'flex', mt: 1, justifyContent: 'flex-end', gap: 1 }}>
                            <IconButton size="small" onClick={() => handleFeedback(sectionId, 'like')} color="primary"><ThumbUpIcon fontSize="small" /></IconButton>
                            <IconButton size="small" onClick={() => handleFeedback(sectionId, 'dislike')}><ThumbDownIcon fontSize="small" /></IconButton>
                          </Box>
                        </>
                      ) : (
                        <Typography color="text.secondary" fontStyle="italic">Content pending generation...</Typography>
                      )}
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          </Fade>
        )}

        {/* PREVIEW MODE */}
        {viewMode === 'preview' && (
          <Fade in={true}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {!hasContent ? (
                <Box sx={{ textAlign: 'center', mt: 8 }}>
                  <Typography variant="h5" color="text.secondary">No content generated yet.</Typography>
                  <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setViewMode('editor')}>Go to Editor to Generate</Button>
                </Box>
              ) : project.document_type === 'docx' ? (
                // WORD PREVIEW (A4 Paper Style)
                <Paper elevation={4} sx={{
                  width: '210mm', minHeight: '297mm', p: '25mm',
                  bgcolor: 'white', mb: 4, mx: 'auto'
                }}>
                  <Typography variant="h3" align="center" gutterBottom sx={{ fontFamily: 'Times New Roman', mb: 4 }}>
                    {project.topic}
                  </Typography>
                  {sortedItems.map((item) => {
                    const id = item.id || `section_${item.order}`;
                    return (
                      <Box key={id} sx={{ mb: 4 }}>
                        <Typography variant="h5" sx={{ fontFamily: 'Times New Roman', fontWeight: 'bold', mb: 1 }}>
                          {item.title}
                        </Typography>
                        <Typography variant="body1" sx={{ fontFamily: 'Times New Roman', whiteSpace: 'pre-wrap', lineHeight: 1.6, textAlign: 'justify' }}>
                          {content[id]?.content}
                        </Typography>
                      </Box>
                    );
                  })}
                </Paper>
              ) : (
                // POWERPOINT PREVIEW (Slide Deck Style)
                <Box sx={{ width: '100%', maxWidth: '900px' }}>
                  <Paper elevation={6} sx={{
                    aspectRatio: '16/9', width: '100%', bgcolor: 'white',
                    display: 'flex', flexDirection: 'column', p: 6, position: 'relative', overflow: 'hidden'
                  }}>
                    {sortedItems[currentSlideIndex] && (
                      <>
                        <Typography variant="h3" sx={{ color: '#2563eb', fontWeight: 'bold', mb: 4 }}>
                          {sortedItems[currentSlideIndex].title}
                        </Typography>
                        <Box sx={{ width: '80px', height: '4px', bgcolor: '#fbbf24', mb: 4 }} />
                        <Typography variant="h5" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                           {content[sortedItems[currentSlideIndex].id || `slide_${sortedItems[currentSlideIndex].order}`]?.content || "No content"}
                        </Typography>
                        <Typography sx={{ position: 'absolute', bottom: 20, right: 30, color: '#9ca3af' }}>
                          {currentSlideIndex + 1} / {sortedItems.length}
                        </Typography>
                      </>
                    )}
                  </Paper>
                  
                  {/* Slide Navigation */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, gap: 2 }}>
                    <IconButton 
                      onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentSlideIndex === 0}
                      sx={{ bgcolor: 'white', boxShadow: 1 }}
                    >
                      <PrevIcon />
                    </IconButton>
                    <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', maxWidth: '400px', p: 1 }}>
                      {sortedItems.map((_, idx) => (
                        <Box
                          key={idx}
                          onClick={() => setCurrentSlideIndex(idx)}
                          sx={{
                            width: 40, height: 25, bgcolor: idx === currentSlideIndex ? 'primary.main' : '#e5e7eb',
                            cursor: 'pointer', borderRadius: 1
                          }}
                        />
                      ))}
                    </Box>
                    <IconButton 
                      onClick={() => setCurrentSlideIndex(prev => Math.min(sortedItems.length - 1, prev + 1))}
                      disabled={currentSlideIndex === sortedItems.length - 1}
                      sx={{ bgcolor: 'white', boxShadow: 1 }}
                    >
                      <NextIcon />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </Box>
          </Fade>
        )}
      </Container>
      
      {/* Floating Action Button for Download (Always visible on mobile) */}
      <Tooltip title="Download File">
        <Fab 
          color="primary" 
          aria-label="download" 
          sx={{ position: 'fixed', bottom: 32, right: 32, display: { md: 'none' } }}
          onClick={handleExport}
          disabled={!hasContent || exporting}
        >
           {exporting ? <CircularProgress size={24} color="inherit" /> : <DownloadIcon />}
        </Fab>
      </Tooltip>
    </Box>
  );
}

export default ProjectDetail;