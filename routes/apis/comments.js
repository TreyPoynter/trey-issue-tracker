import * as dotenv from "dotenv"
import express from 'express';
import debug from 'debug';
import Joi from "joi";
import { getCommentsForBug, getCommentById, addCommentToBug } from "../../database.js";
import {validId} from '../../middleware/validId.js';
import {validBody} from '../../middleware/validBody.js';
import {isLoggedIn, hasPermission} from "@merlin4/express-auth";

const commentSchema = Joi.object({
	text: Joi.string().trim().required(),
});
dotenv.config();
const router = express.Router();
const debugComment = debug('app:Comment');
router.use(express.urlencoded({extended:false}));

router.get('/:bugId/comment/list', isLoggedIn(), hasPermission('canViewData'), validId("bugId"), async (req, res) => {
    const id = req.bugId;
    try {
        const comments = await getCommentsForBug(id);
        if (comments.length > 0) {
            res.status(200).json(comments);
        } else {
            res.status(400).json(comments);
        }
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});
router.get('/:bugId/comment/:commentId', isLoggedIn(), hasPermission('canViewData'),
validId("bugId"), validId("commentId"), async (req, res) => {
    const bugId = req.bugId;
    const commentId = req.commentId;
    try {
        const comment = await getCommentById(bugId, commentId);
        if (comment) {
            res.status(200).json(comment);
        } else {
            res.status(400).json(comment);
        }
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});
router.put('/:bugId/comment/new', isLoggedIn(), hasPermission('canAddComments'),
validId('bugId'), validBody(commentSchema), async (req, res) => {
    const id  = req.bugId;
    const newComment = req.body;
    try {
        const result = await addCommentToBug(id, newComment, req.auth);
        res.status(200).json(result);
    } catch (err) {
    }
});

export {router as CommentRouter};
