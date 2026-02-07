/**
 * Review Routes
 * Mounted at /api/coaches/:coachId/reviews
 */

import { Router } from 'express';
import { z } from 'zod';
import { reviewController } from '../controllers/reviewController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().trim().min(10, 'Review must be at least 10 characters').max(1000),
  sessionId: z.string().optional(),
});

const router = Router({ mergeParams: true });

// Get reviews for a coach (public)
router.get('/', (req, res) => reviewController.getCoachReviews(req, res));

// Create a review (authenticated)
router.post('/', authenticate, validate(createReviewSchema), (req, res) =>
  reviewController.createReview(req, res)
);

// Get current user's review for this coach (authenticated)
router.get('/me', authenticate, (req, res) => reviewController.getUserReview(req, res));

// Delete a review (authenticated, author only)
router.delete('/:reviewId', authenticate, (req, res) =>
  reviewController.deleteReview(req, res)
);

export default router;
