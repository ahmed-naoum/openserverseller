import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';

export const checkDeploymentOnStartup = async () => {
  const projectDir = process.cwd();
  const depIdPath = path.join(projectDir, 'current_deployment.txt');
  const depStatusPath = path.join(projectDir, 'deployment_status.txt');
  const depLogPath = path.join(projectDir, 'deployment.log');

  if (fs.existsSync(depIdPath)) {
    const deploymentId = fs.readFileSync(depIdPath, 'utf8').trim();
    let status = 'SUCCESS';
    let logOutput = '';

    if (fs.existsSync(depStatusPath)) {
      status = fs.readFileSync(depStatusPath, 'utf8').trim();
    }
    if (fs.existsSync(depLogPath)) {
      logOutput = fs.readFileSync(depLogPath, 'utf8');
    }

    try {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status,
          logOutput
        }
      });
      console.log(`[DEPLOYMENT] Reconciled deployment ${deploymentId} with status ${status}`);
    } catch (err) {
      console.error('[DEPLOYMENT] Failed to reconcile deployment in DB:', err);
    } finally {
      try {
        fs.unlinkSync(depIdPath);
        if (fs.existsSync(depStatusPath)) fs.unlinkSync(depStatusPath);
        if (fs.existsSync(depLogPath)) fs.unlinkSync(depLogPath);
      } catch (cleanupErr) {
        console.warn('[DEPLOYMENT] Failed to clean up temp files:', cleanupErr);
      }
    }
  }
};
