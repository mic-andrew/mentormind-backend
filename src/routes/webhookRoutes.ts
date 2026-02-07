/**
 * Webhook routes
 * No JWT auth middleware - uses custom header verification in controller
 */

import { Router } from 'express';
import { webhookController } from '../controllers/webhookController';

const router = Router();

router.post('/revenuecat', (req, res) => webhookController.handleRevenueCat(req, res));

export default router;
