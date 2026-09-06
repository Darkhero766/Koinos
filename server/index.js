// KOINOS reference backend — a small, dependency-light Express API that demonstrates
// the "Backend APIs" skill required by the Community Connect problem statement.
// It is intentionally separate from the static front-end deploy (index.html/app.js),
// which keeps working on its own with in-memory demo data if this server isn't running.
//
// Run it:
//   cd server && npm install && npm start
// It listens on PORT (default 4000) and stores data in ./data/issues.json.

import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "issues.json");
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" })); // generous limit so a base64 report photo can ride along

const readIssues = async () => JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
const writeIssues = async (issues) => fs.writeFile(DATA_FILE, JSON.stringify(issues, null, 2));

// --- Bonus feature: lightweight severity prediction -----------------------------------
// Heuristic keyword scoring rather than a trained model — transparent and fast, and easy
// to swap out for a real ML/LLM call later without changing the API shape.
const SEVERITY_KEYWORDS = {
  high: ["danger", "unsafe", "accident", "injur", "flood", "collapse", "exposed wire", "fire", "school"],
  medium: ["block", "leak", "overflow", "broken", "damaged", "pothole"],
};
function predictSeverity(description = "") {
  const text = description.toLowerCase();
  if (SEVERITY_KEYWORDS.high.some((word) => text.includes(word))) return "high";
  if (SEVERITY_KEYWORDS.medium.some((word) => text.includes(word))) return "medium";
  return "low";
}

// --- Bonus feature: AI-generated-style summary -----------------------------------------
// A short, deterministic extractive summary. Swap the body of this function for a call to
// an LLM provider to get true generative summaries without touching any route below.
function summarize(issue) {
  const place = issue.location?.label ? ` near ${issue.location.label}` : "";
  return `${issue.title}${place}. Reported ${issue.anonymous ? "anonymously" : "by a community member"}, ` +
    `flagged as ${issue.severity} severity with ${issue.upvotes} neighbor${issue.upvotes === 1 ? "" : "s"} affected.`;
}

// GET /api/issues — list all issues, newest first
app.get("/api/issues", async (_req, res) => {
  const issues = await readIssues();
  res.json(issues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// GET /api/issues/:id
app.get("/api/issues/:id", async (req, res) => {
  const issues = await readIssues();
  const issue = issues.find((item) => item.id === req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  res.json({ ...issue, aiSummary: summarize(issue) });
});

// POST /api/issues — report a new civic issue
app.post("/api/issues", async (req, res) => {
  const { title, category, description, location, photoUrl, anonymous } = req.body || {};
  if (!description && !title) {
    return res.status(400).json({ error: "A title or description is required" });
  }
  const issues = await readIssues();
  const now = new Date().toISOString();
  const issue = {
    id: nanoid(10),
    title: title || "Untitled report",
    category: category || "unclassified",
    description: description || "",
    location: location || null,
    photoUrl: photoUrl || null,
    anonymous: Boolean(anonymous),
    status: "reported",
    severity: predictSeverity(description),
    upvotes: 0,
    createdAt: now,
    updatedAt: now,
  };
  issues.push(issue);
  await writeIssues(issues);
  res.status(201).json({ ...issue, aiSummary: summarize(issue) });
});

// POST /api/issues/:id/upvote — "I'm affected too"
app.post("/api/issues/:id/upvote", async (req, res) => {
  const issues = await readIssues();
  const issue = issues.find((item) => item.id === req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  issue.upvotes += 1;
  issue.updatedAt = new Date().toISOString();
  await writeIssues(issues);
  res.json(issue);
});

// PATCH /api/issues/:id/status — Reported -> In Progress -> Resolved
const VALID_STATUSES = ["reported", "in_progress", "resolved"];
app.patch("/api/issues/:id/status", async (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` });
  }
  const issues = await readIssues();
  const issue = issues.find((item) => item.id === req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue not found" });
  issue.status = status;
  issue.updatedAt = new Date().toISOString();
  await writeIssues(issues);
  res.json(issue);
});

// GET /api/analytics — aggregated numbers for the authority dashboard
app.get("/api/analytics", async (_req, res) => {
  const issues = await readIssues();
  const total = issues.length;
  const resolved = issues.filter((i) => i.status === "resolved");
  const byCategory = issues.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});
  const avgResolutionDays = resolved.length
    ? resolved.reduce((sum, i) => sum + (new Date(i.updatedAt) - new Date(i.createdAt)) / 86400000, 0) / resolved.length
    : 0;
  res.json({
    totalReports: total,
    resolved: resolved.length,
    resolutionRate: total ? Math.round((resolved.length / total) * 100) : 0,
    avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
    byCategory,
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`KOINOS API listening on http://localhost:${PORT}`);
});
