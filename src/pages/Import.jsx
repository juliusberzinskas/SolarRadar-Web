import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Snackbar,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

import SolarPowerIcon from "@mui/icons-material/SolarPower";
import GroupIcon from "@mui/icons-material/Group";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReplayIcon from "@mui/icons-material/Replay";

import PageHeader from "../components/PageHeader";
import {
  downloadTemplate,
  importMembers,
  importSites,
  MEMBERS_HEADERS,
  parseFile,
  SITES_HEADERS,
  validateRows,
} from "../utils/importUtils";

// ── Column definitions for preview grids ────────────────────────────────────

function makeColumns(headers) {
  return headers.map((h) => ({
    field: h,
    headerName: h,
    flex: 1,
    minWidth: 110,
    sortable: false,
  }));
}

const SITES_COLUMNS  = makeColumns(SITES_HEADERS);
const MEMBERS_COLUMNS = makeColumns(MEMBERS_HEADERS);

// ── Step 1: choose type ───────────────────────────────────────────────────────

function ChooseType({ onSelect }) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {t("pages.import.step1.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("pages.import.step1.subtitle")}
      </Typography>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {[
          { key: "sites",   icon: <SolarPowerIcon sx={{ fontSize: 40, color: "#60a5fa" }} />, labelKey: "pages.import.type.sites",   descKey: "pages.import.type.sitesDesc" },
          { key: "members", icon: <GroupIcon       sx={{ fontSize: 40, color: "#34d399" }} />, labelKey: "pages.import.type.members", descKey: "pages.import.type.membersDesc" },
        ].map(({ key, icon, labelKey, descKey }) => (
          <Card
            key={key}
            sx={{ width: 220, flexShrink: 0, border: "1px solid", borderColor: "divider" }}
          >
            <CardActionArea onClick={() => onSelect(key)} sx={{ p: 3, height: "100%" }}>
              <CardContent sx={{ p: 0, textAlign: "center" }}>
                {icon}
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1.5 }}>
                  {t(labelKey)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t(descKey)}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

// ── Step 2: upload + preview ──────────────────────────────────────────────────

function UploadStep({ type, rows, validationErrors, onFileChange, onBack }) {
  const { t } = useTranslation();
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);

  const columns = type === "sites" ? SITES_COLUMNS : MEMBERS_COLUMNS;
  const rowsWithId = rows.map((r, i) => ({ id: i, ...r }));

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileChange(file);
    },
    [onFileChange]
  );

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        size="small"
        sx={{ mb: 2, color: "text.secondary" }}
      >
        {t("common.back")}
      </Button>

      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {t("pages.import.step2.title", { type: t(`pages.import.type.${type}`) })}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("pages.import.step2.subtitle")}
      </Typography>

      {/* Template download */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<DownloadIcon />}
        onClick={() => downloadTemplate(type)}
        sx={{ mb: 3 }}
      >
        {t("pages.import.downloadTemplate")}
      </Button>

      {/* Drop zone */}
      <Paper
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        sx={{
          border: "2px dashed",
          borderColor: dragging ? "primary.main" : "divider",
          borderRadius: 2,
          p: 4,
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.2s",
          bgcolor: dragging ? "action.hover" : "transparent",
          mb: 3,
        }}
      >
        <UploadFileIcon sx={{ fontSize: 36, color: "text.secondary", mb: 1 }} />
        <Typography variant="body1" fontWeight={500}>
          {t("pages.import.dropzone.label")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("pages.import.dropzone.hint")}
        </Typography>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.[0]) onFileChange(e.target.files[0]); }}
        />
      </Paper>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t("pages.import.validationErrors", { count: validationErrors.length })}
          </Typography>
          {validationErrors.slice(0, 5).map((e) => (
            <Typography key={e.row} variant="body2">
              {t("pages.import.rowError", { row: e.row, errors: e.errors.join(", ") })}
            </Typography>
          ))}
          {validationErrors.length > 5 && (
            <Typography variant="body2">
              {t("pages.import.moreErrors", { count: validationErrors.length - 5 })}
            </Typography>
          )}
        </Alert>
      )}

      {/* Preview grid */}
      {rows.length > 0 && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              {t("pages.import.preview", { count: rows.length })}
            </Typography>
            {validationErrors.length === 0 && (
              <Chip label={t("pages.import.readyToImport")} color="success" size="small" />
            )}
          </Box>
          <Box sx={{ height: 320 }}>
            <DataGrid
              rows={rowsWithId}
              columns={columns}
              disableRowSelectionOnClick
              hideFooterSelectedRowCount
              pageSizeOptions={[10, 25]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              density="compact"
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Step 3: result ────────────────────────────────────────────────────────────

function ResultStep({ result, type, onReset }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ textAlign: "center", py: 4 }}>
      <CheckCircleIcon sx={{ fontSize: 56, color: "success.main", mb: 2 }} />
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
        {t("pages.import.result.title")}
      </Typography>
      <Typography variant="body1" sx={{ mb: 0.5 }}>
        {t("pages.import.result.imported", { count: result.imported })}
      </Typography>
      {result.skipped > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {t("pages.import.result.skipped", { count: result.skipped })}
        </Typography>
      )}
      {result.errors?.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2, textAlign: "left" }}>
          {result.errors.slice(0, 3).map((e, i) => (
            <Typography key={i} variant="body2">{e}</Typography>
          ))}
        </Alert>
      )}
      <Button
        startIcon={<ReplayIcon />}
        variant="outlined"
        sx={{ mt: 3 }}
        onClick={onReset}
      >
        {t("pages.import.importAnother")}
      </Button>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STEPS_KEYS = [
  "pages.import.steps.chooseType",
  "pages.import.steps.uploadPreview",
  "pages.import.steps.confirm",
];

export default function Import() {
  const { t } = useTranslation();

  const [step, setStep]                       = useState(0);
  const [type, setType]                       = useState(null);
  const [rows, setRows]                       = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importing, setImporting]             = useState(false);
  const [result, setResult]                   = useState(null);
  const [parseError, setParseError]           = useState("");

  const handleSelectType = (t) => {
    setType(t);
    setRows([]);
    setValidationErrors([]);
    setParseError("");
    setStep(1);
  };

  const handleFileChange = async (file) => {
    setParseError("");
    setRows([]);
    setValidationErrors([]);
    try {
      const parsed = await parseFile(file);
      setRows(parsed);
      setValidationErrors(validateRows(type, parsed));
    } catch (e) {
      setParseError(e.message);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = type === "sites"
        ? await importSites(rows)
        : await importMembers(rows);
      setResult(res);
      setStep(2);
    } catch (e) {
      setParseError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setType(null);
    setRows([]);
    setValidationErrors([]);
    setResult(null);
    setParseError("");
  };

  const canImport = rows.length > 0 && validationErrors.length === 0 && !importing;

  return (
    <Box>
      <PageHeader
        title={t("pages.import.title")}
        subtitle={t("pages.import.subtitle")}
      />

      <Paper sx={{ p: { xs: 2, sm: 3 }, mt: 2 }}>
        {/* Stepper */}
        <Stepper activeStep={step} sx={{ mb: 4 }}>
          {STEPS_KEYS.map((key) => (
            <Step key={key}>
              <StepLabel>{t(key)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step content */}
        {step === 0 && <ChooseType onSelect={handleSelectType} />}

        {step === 1 && (
          <Box>
            <UploadStep
              type={type}
              rows={rows}
              validationErrors={validationErrors}
              onFileChange={handleFileChange}
              onBack={() => setStep(0)}
            />
            {parseError && (
              <Alert severity="error" sx={{ mt: 2 }}>{parseError}</Alert>
            )}
            {rows.length > 0 && (
              <Box sx={{ mt: 3, display: "flex", gap: 1.5 }}>
                <Button
                  variant="contained"
                  disabled={!canImport}
                  onClick={handleImport}
                  startIcon={importing ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  {importing
                    ? t("pages.import.importing")
                    : t("pages.import.confirmImport", { count: rows.length })}
                </Button>
              </Box>
            )}
          </Box>
        )}

        {step === 2 && (
          <ResultStep result={result} type={type} onReset={handleReset} />
        )}
      </Paper>

      <Snackbar
        open={!!parseError && step === 1}
        autoHideDuration={5000}
        onClose={() => setParseError("")}
        message={parseError}
      />
    </Box>
  );
}
