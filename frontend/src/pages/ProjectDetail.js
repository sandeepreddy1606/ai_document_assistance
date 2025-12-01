import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  TextField,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Fade,
} from '@mui/material';

import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Comment as CommentIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  AutoFixHigh as MagicIcon,
  FormatBold as BoldIcon,
  FormatListBulleted as BulletedIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

import api from '../config/api';
import { useSnackbar } from '../contexts/SnackbarContext';

function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  // Data state
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState({});
  const [exporting, setExporting] = useState(false);

  // UI state
  const [viewMode, setViewMode] = useState('editor');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Preview styling
  const [previewFontSize, setPreviewFontSize] = useState(16);
  const [previewBold, setPreviewBold] = useState(false);

  // Refinement prompts + comments
  const [refinementPrompts, setRefinementPrompts] = useState({});
  const [comments, setComments] = useState({});
  const [commentDialog, setCommentDialog] = useState({
    open: false,
    sectionId: null,
  });

  // Manual edit saving
  const [savingSection, setSavingSection] = useState({});

  // Refs for each section editor
  const editorRefs = useRef({});

  useEffect(() => {
    fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function fetchProject() {
    try {
      const response = await api.get(`/api/projects/${projectId}`);
      const projectData = response.data;
      setProject(projectData);

      const content = projectData.content || {};
      const prompts = {};
      Object.keys(content).forEach((key) => {
        prompts[key] = '';
      });
      setRefinementPrompts((prev) => ({ ...prompts, ...prev }));

      // hydrate comments from history
      const history = projectData.refinement_history || [];
      const commentMap = {};
      history.forEach((entry) => {
        if (entry.type === 'comment' && entry.section_id) {
          commentMap[entry.section_id] = entry.value || '';
        }
      });
      setComments(commentMap);
    } catch (err) {
      console.error(err);
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
      setViewMode('preview');
      showSnackbar('Content generated successfully!');
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to generate content', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefine(sectionId) {
    const prompt = refinementPrompts[sectionId];
    if (!prompt?.trim()) {
      showSnackbar('Enter a prompt first', 'warning');
      return;
    }

    try {
      setRefining((prev) => ({ ...prev, [sectionId]: true }));
      await api.post(`/api/documents/${projectId}/refine`, {
        section_id: sectionId,
        prompt,
      });
      setRefinementPrompts((prev) => ({ ...prev, [sectionId]: '' }));
      await fetchProject();
      showSnackbar('Section refined!');
    } catch (err) {
      console.error(err);
      showSnackbar('Refinement failed', 'error');
    } finally {
      setRefining((prev) => ({ ...prev, [sectionId]: false }));
    }
  }

  async function handleFeedback(sectionId, type) {
    try {
      await api.post(`/api/documents/${projectId}/feedback`, {
        section_id: sectionId,
        feedback_type: type,
      });
      await fetchProject();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to record feedback', 'error');
    }
  }

  // Rich-text formatting helpers (uncontrolled editor)
  const applyFormat = (sectionId, command) => {
    const el = editorRefs.current[sectionId];
    if (!el) return;
    el.focus();
    try {
      document.execCommand(command, false, null);
    } catch (e) {
      console.warn('execCommand failed', e);
    }
  };

  async function handleSaveSection(sectionId) {
    const el = editorRefs.current[sectionId];
    if (!el) {
      showSnackbar('Editor not ready', 'error');
      return;
    }
    const html = el.innerHTML;

    try {
      setSavingSection((prev) => ({ ...prev, [sectionId]: true }));
      await api.post(`/api/documents/${projectId}/update-section`, {
        section_id: sectionId,
        content: html,
      });
      await fetchProject();
      showSnackbar('Section saved', 'success');
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to save section', 'error');
    } finally {
      setSavingSection((prev) => ({ ...prev, [sectionId]: false }));
    }
  }

  // Comments
  async function handleSaveComment() {
    const sectionId = commentDialog.sectionId;
    if (!sectionId) return;

    const text = comments[sectionId];
    if (!text || !text.trim()) {
      showSnackbar('Enter a comment first', 'warning');
      return;
    }

    try {
      await api.post(`/api/documents/${projectId}/comment`, {
        section_id: sectionId,
        comment: text,
      });
      showSnackbar('Comment saved');
      await fetchProject();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to save comment', 'error');
    } finally {
      setCommentDialog({ open: false, sectionId: null });
    }
  }

  async function handleExport() {
    if (!project) return;

    try {
      setExporting(true);
      const response = await api.get(
        `/api/documents/${projectId}/export`,
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(
        new Blob([response.data]),
      );
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${project.name}.${project.document_type}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSnackbar('Download started!');
    } catch (err) {
      console.error(err);
      showSnackbar('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  // ---- Render helpers ----

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography>Project not found</Typography>
      </Box>
    );
  }

  const content = project.content || {};
  const hasContent = Object.keys(content).length > 0;

  const items =
    project.document_type === 'docx'
      ? project.outline
      : project.slides;

  const sortedItems = [...(items || [])].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f3f4f6' }}>
      {/* Top Bar */}
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{
          borderBottom: '1px solid #e5e7eb',
          bgcolor: 'white',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => navigate('/dashboard')}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>

          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {project.name}
          </Typography>

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newView) => {
              if (newView) setViewMode(newView);
            }}
            size="small"
            sx={{ mr: 2 }}
          >
            <ToggleButton value="editor">
              <EditIcon sx={{ mr: 0.5 }} fontSize="small" />
              Editor
            </ToggleButton>
            <ToggleButton value="preview">
              <ViewIcon sx={{ mr: 0.5 }} fontSize="small" />
              Preview
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="contained"
            startIcon={
              exporting ? <CircularProgress size={16} /> : <DownloadIcon />
            }
            onClick={handleExport}
            disabled={exporting || !hasContent}
          >
            Download
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* EDITOR MODE */}
        {viewMode === 'editor' && (
          <>
            <Paper
              elevation={1}
              sx={{
                p: 3,
                mb: 3,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Topic
                </Typography>
                <Typography variant="h6">{project.topic}</Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={
                  generating ? (
                    <CircularProgress size={18} />
                  ) : (
                    <MagicIcon />
                  )
                }
                onClick={handleGenerateContent}
                disabled={generating}
              >
                {hasContent ? 'Regenerate All' : 'Generate Content'}
              </Button>
            </Paper>

            {sortedItems.map((item, index) => {
              const sectionId =
                item.id ||
                (project.document_type === 'docx'
                  ? `section_${item.order}`
                  : `slide_${item.order}`);

              const sectionContent = content[sectionId];

              return (
                <Accordion key={sectionId} sx={{ mb: 1.5 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {index + 1}. {item.title}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {sectionContent?.content ? (
                      <>
                        {/* Toolbar */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 1,
                          }}
                        >
                          <Tooltip title="Bold">
                            <IconButton
                              size="small"
                              onClick={() =>
                                applyFormat(sectionId, 'bold')
                              }
                            >
                              <BoldIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Bulleted list">
                            <IconButton
                              size="small"
                              onClick={() =>
                                applyFormat(
                                  sectionId,
                                  'insertUnorderedList',
                                )
                              }
                            >
                              <BulletedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        {/* Rich text editor box (uncontrolled) */}
                        <Box
                          sx={{
                            borderRadius: 2,
                            border: '1px solid #e5e7eb',
                            p: 2,
                            minHeight: '140px',
                            bgcolor: 'white',
                            mb: 2,
                            '&:focus-within': {
                              borderColor: 'primary.main',
                              boxShadow:
                                '0 0 0 1px rgba(59,130,246,0.4)',
                            },
                          }}
                        >
                          <div
                            ref={(el) =>
                              (editorRefs.current[sectionId] = el)
                            }
                            contentEditable
                            suppressContentEditableWarning
                            dangerouslySetInnerHTML={{
                              __html: sectionContent.content,
                            }}
                            style={{
                              outline: 'none',
                              whiteSpace: 'pre-wrap',
                            }}
                          />
                        </Box>

                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5,
                          }}
                        >
                          {/* AI refinement prompt */}
                          <TextField
                            label="AI Instruction"
                            placeholder='e.g., "Make it longer", "Fix grammar", "Convert to bullet points"...'
                            fullWidth
                            multiline
                            minRows={2}
                            value={refinementPrompts[sectionId] || ''}
                            onChange={(e) =>
                              setRefinementPrompts((prev) => ({
                                ...prev,
                                [sectionId]: e.target.value,
                              }))
                            }
                          />

                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Button
                              variant="contained"
                              startIcon={
                                refining[sectionId] ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <RefreshIcon />
                                )
                              }
                              onClick={() => handleRefine(sectionId)}
                              disabled={
                                refining[sectionId] ||
                                !refinementPrompts[sectionId]
                              }
                            >
                              {refining[sectionId] ? 'Refining...' : 'Refine'}
                            </Button>

                            {/* Save manual edits */}
                            <Button
                              variant="outlined"
                              startIcon={
                                savingSection[sectionId] ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <SaveIcon />
                                )
                              }
                              onClick={() => handleSaveSection(sectionId)}
                              disabled={savingSection[sectionId]}
                            >
                              Save changes
                            </Button>

                            {/* Feedback */}
                            <Tooltip title="This section is good">
                              <IconButton
                                onClick={() =>
                                  handleFeedback(sectionId, 'like')
                                }
                                color="primary"
                              >
                                <ThumbUpIcon />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="This section needs work">
                              <IconButton
                                onClick={() =>
                                  handleFeedback(sectionId, 'dislike')
                                }
                              >
                                <ThumbDownIcon />
                              </IconButton>
                            </Tooltip>

                            {/* Comment */}
                            <Tooltip title="Add or edit your notes for this section">
                              <IconButton
                                onClick={() =>
                                  setCommentDialog({
                                    open: true,
                                    sectionId,
                                  })
                                }
                              >
                                <CommentIcon />
                              </IconButton>
                            </Tooltip>

                            {comments[sectionId] && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ ml: 1, maxWidth: 320 }}
                                noWrap
                              >
                                Comment: {comments[sectionId]}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </>
                    ) : (
                      <Typography color="text.secondary">
                        Content pending generation...
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </>
        )}

        {/* PREVIEW MODE */}
        {viewMode === 'preview' && (
          <Box sx={{ mt: 3 }}>
            {!hasContent ? (
              <Paper
                elevation={2}
                sx={{
                  p: 4,
                  textAlign: 'center',
                  minHeight: '40vh',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h6" gutterBottom>
                  No content generated yet.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => setViewMode('editor')}
                  sx={{ mt: 2 }}
                >
                  Go to Editor to Generate
                </Button>
              </Paper>
            ) : (
              <>
                {/* Preview controls */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ mr: 1 }}>
                    Text style:
                  </Typography>
                  <ToggleButton
                    size="small"
                    value="bold"
                    selected={previewBold}
                    onChange={() =>
                      setPreviewBold((prev) => !prev)
                    }
                  >
                    <b>B</b>
                  </ToggleButton>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      setPreviewFontSize((s) => Math.max(12, s - 2))
                    }
                  >
                    A-
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      setPreviewFontSize((s) => Math.min(28, s + 2))
                    }
                  >
                    A+
                  </Button>
                </Box>

                {project.document_type === 'docx' ? (
                  // DOCX preview
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Paper
                      elevation={3}
                      sx={{
                        width: '100%',
                        maxWidth: 900,
                        minHeight: '75vh',
                        bgcolor: '#ffffff',
                        borderRadius: 2,
                        p: 6,
                      }}
                    >
                      <Typography
                        variant="h5"
                        align="center"
                        gutterBottom
                        sx={{ fontWeight: 600, mb: 4 }}
                      >
                        {project.topic}
                      </Typography>

                      {sortedItems.map((item) => {
                        const id =
                          item.id || `section_${item.order}`;
                        const sectionHtml =
                          content[id]?.content || '';
                        return (
                          <Box key={id} sx={{ mb: 3 }}>
                            <Typography
                              variant="h6"
                              sx={{ fontWeight: 600, mb: 1 }}
                            >
                              {item.title}
                            </Typography>
                            <Box
                              sx={{
                                fontSize: previewFontSize,
                                fontWeight: previewBold
                                  ? 'bold'
                                  : 'normal',
                                lineHeight: 1.6,
                              }}
                              dangerouslySetInnerHTML={{
                                __html: sectionHtml,
                              }}
                            />
                          </Box>
                        );
                      })}
                    </Paper>
                  </Box>
                ) : (
                  // PPT preview
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Paper
                      elevation={3}
                      sx={{
                        width: '100%',
                        maxWidth: 960,
                        aspectRatio: '16 / 9',
                        bgcolor: '#ffffff',
                        borderRadius: 2,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {sortedItems[currentSlideIndex] && (
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            p: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography
                            variant="h4"
                            sx={{ fontWeight: 700, mb: 2 }}
                          >
                            {
                              sortedItems[currentSlideIndex]
                                .title
                            }
                          </Typography>
                          <Box
                            sx={{
                              fontSize: previewFontSize,
                              fontWeight: previewBold
                                ? 'bold'
                                : 'normal',
                              lineHeight: 1.6,
                            }}
                            dangerouslySetInnerHTML={{
                              __html:
                                content[
                                  sortedItems[currentSlideIndex]
                                    .id ||
                                    `slide_${sortedItems[currentSlideIndex].order}`
                                ]?.content || 'No content',
                            }}
                          />
                        </Box>
                      )}
                    </Paper>

                    {/* Slide nav */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() =>
                          setCurrentSlideIndex((prev) =>
                            Math.max(0, prev - 1),
                          )
                        }
                        disabled={currentSlideIndex === 0}
                        sx={{ bgcolor: 'white', boxShadow: 1 }}
                      >
                        <PrevIcon />
                      </IconButton>

                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {sortedItems.map((_, idx) => (
                          <Box
                            key={idx}
                            onClick={() =>
                              setCurrentSlideIndex(idx)
                            }
                            sx={{
                              width: 40,
                              height: 25,
                              bgcolor:
                                idx === currentSlideIndex
                                  ? 'primary.main'
                                  : '#e5e7eb',
                              cursor: 'pointer',
                              borderRadius: 1,
                            }}
                          />
                        ))}
                      </Box>

                      <IconButton
                        size="small"
                        onClick={() =>
                          setCurrentSlideIndex((prev) =>
                            Math.min(
                              sortedItems.length - 1,
                              prev + 1,
                            ),
                          )
                        }
                        disabled={
                          currentSlideIndex ===
                          sortedItems.length - 1
                        }
                        sx={{ bgcolor: 'white', boxShadow: 1 }}
                      >
                        <NextIcon />
                      </IconButton>

                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {currentSlideIndex + 1} /{' '}
                        {sortedItems.length}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </Container>

      {/* Download FAB */}
      <Fade in={hasContent}>
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
          }}
        >
          <Tooltip title="Download document">
            <Fab
              color="primary"
              onClick={handleExport}
              disabled={exporting || !hasContent}
            >
              {exporting ? (
                <CircularProgress size={24} />
              ) : (
                <DownloadIcon />
              )}
            </Fab>
          </Tooltip>
        </Box>
      </Fade>

      {/* Comment dialog */}
      <Dialog
        open={commentDialog.open}
        onClose={() =>
          setCommentDialog({ open: false, sectionId: null })
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            placeholder="Write your notes about this section. These will be stored with the project."
            value={comments[commentDialog.sectionId] || ''}
            onChange={(e) =>
              setComments((prev) => ({
                ...prev,
                [commentDialog.sectionId]: e.target.value,
              }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setCommentDialog({ open: false, sectionId: null })
            }
          >
            Close
          </Button>
          <Button
            onClick={handleSaveComment}
            variant="contained"
            disabled={
              !commentDialog.sectionId ||
              !(
                comments[commentDialog.sectionId] &&
                comments[commentDialog.sectionId].trim()
              )
            }
          >
            Save Comment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProjectDetail;
