import type { ProjectGroup, GitHubRepository } from '../types';
import {
  validateProjectName,
  validateSpreadsheetId,
  validateRepositoryOwner,
  validateRepositoryName,
} from '../utils/validation';
import { auditLog } from '../utils/auditLog';
import { validateSpreadsheetAccess } from '../utils/spreadsheetValidator';
import { getConfig, setConfig } from './core';

/**
 * プロジェクトグループを取得
 */
export function getProjects(): ProjectGroup[] {
  const config = getConfig();
  return config.projects ?? [];
}

/**
 * プロジェクトグループを追加
 */
export function addProject(project: ProjectGroup): void {
  // 入力検証
  validateProjectName(project.name);
  validateSpreadsheetId(project.spreadsheetId);
  // スプレッドシートへのアクセス権限を検証
  validateSpreadsheetAccess(project.spreadsheetId);

  const config = getConfig();
  const projects = config.projects ?? [];

  const exists = projects.some((p) => p.name === project.name);
  if (exists) {
    throw new Error(`Project "${project.name}" already exists`);
  }

  projects.push(project);
  setConfig({ projects });

  // 監査ログ
  auditLog('project.create', {
    name: project.name,
    spreadsheetId: project.spreadsheetId,
    sheetName: project.sheetName,
  });
}

/**
 * プロジェクトグループを更新
 */
export function updateProject(name: string, updates: Partial<Omit<ProjectGroup, 'name'>>): void {
  // 入力検証
  if (updates.spreadsheetId) {
    validateSpreadsheetId(updates.spreadsheetId);
  }

  const config = getConfig();
  const projects = config.projects ?? [];

  const index = projects.findIndex((p) => p.name === name);
  if (index === -1) {
    throw new Error(`Project "${name}" not found`);
  }

  projects[index] = { ...projects[index], ...updates };
  setConfig({ projects });

  // 監査ログ
  auditLog('project.update', { name, updates });
}

/**
 * プロジェクトグループを削除
 */
export function removeProject(name: string): void {
  const config = getConfig();
  const beforeCount = (config.projects ?? []).length;
  const projects = (config.projects ?? []).filter((p) => p.name !== name);
  const afterCount = projects.length;

  if (beforeCount !== afterCount) {
    setConfig({ projects });

    // 監査ログ
    auditLog('project.delete', { name });
  }
}

/**
 * プロジェクトグループにリポジトリを追加
 */
export function addRepositoryToProject(projectName: string, owner: string, repoName: string): void {
  // 入力検証
  validateRepositoryOwner(owner);
  validateRepositoryName(repoName);

  const config = getConfig();
  const projects = config.projects ?? [];

  const project = projects.find((p) => p.name === projectName);
  if (!project) {
    throw new Error(`Project "${projectName}" not found`);
  }

  const newRepo: GitHubRepository = { owner, name: repoName, fullName: `${owner}/${repoName}` };
  const exists = project.repositories.some((r) => r.fullName === newRepo.fullName);

  if (!exists) {
    project.repositories.push(newRepo);
    setConfig({ projects });

    // 監査ログ
    auditLog('project.repository.add', {
      projectName,
      owner,
      repoName,
      fullName: newRepo.fullName,
    });
  }
}

/**
 * プロジェクトグループからリポジトリを削除
 */
export function removeRepositoryFromProject(projectName: string, fullName: string): void {
  const config = getConfig();
  const projects = config.projects ?? [];

  const project = projects.find((p) => p.name === projectName);
  if (!project) {
    throw new Error(`Project "${projectName}" not found`);
  }

  const beforeCount = project.repositories.length;
  project.repositories = project.repositories.filter((r) => r.fullName !== fullName);
  const afterCount = project.repositories.length;

  if (beforeCount !== afterCount) {
    setConfig({ projects });

    // 監査ログ
    auditLog('project.repository.remove', { projectName, fullName });
  }
}
