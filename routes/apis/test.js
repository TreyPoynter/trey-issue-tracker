import * as dotenv from "dotenv"
import express from 'express';
import debug from 'debug';
import Joi from "joi";
import {getTestsForBug, getTestById, addTestToBug, updateTestById, deleteTestById,
createEdit, saveEdit, newId } from "../../database.js";
import {validId} from '../../middleware/validId.js';
import {validBody} from '../../middleware/validBody.js';
import {isLoggedIn, hasPermission} from "@merlin4/express-auth";

const testcaseSchema = Joi.object({
    status: Joi.string().lowercase().valid('passed', 'failed').required()
});
dotenv.config();
const router = express.Router();
const debugTest = debug('app:Test');
router.use(express.urlencoded({extended:false}));

router.get('/:bugId/test/list', isLoggedIn(), hasPermission('canViewData'), validId('bugId'), async (req, res) => {
    const id = req.bugId;
    try {
        const comments = await getTestsForBug(id);
        if (comments) {
            res.status(200).json(comments);
        } else {
            res.status(400).json(comments);
        }
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});
router.get('/:bugId/test/:testId', isLoggedIn(), hasPermission('canViewData'), validId('bugId'), validId('testId'), async (req, res) => {
    const bugId = req.bugId;
    const testId = req.testId;
    try {
        const test = await getTestById(bugId, testId);
        if (test) {
            res.status(200).json(test);
        } else {
            res.status(400).json(test);
        }
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});
router.put('/:bugId/test/new', isLoggedIn(), hasPermission('canAddTestCase'), 
validId('bugId'), validBody(testcaseSchema), async (req, res) => {
    const bugId = req.bugId;
    const newTest = req.body;
    try {
        const result = await addTestToBug(bugId, newTest, req.auth);
        if (result.status == 200) {
            const edit = createEdit("Insert", "Testcase", result.insertedId, req.body, req.auth);
            const editResult = await saveEdit(edit);
        }
        res.status(result.status).json({message:result.message});
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});
router.put('/:bugId/test/:testId', isLoggedIn(), hasPermission('canEditTestCase'), 
validId('testId'), validId('bugId'), validBody(testcaseSchema), 
    async (req, res) => {
    const testId = req.testId;
    const bugId = req.bugId;
    const updatedTest = req.body;

    try {
        const result = await updateTestById(bugId, testId, updatedTest, req.auth);
        if (result.status == 200) {
            const edit = createEdit("Update", "Testcase", newId(testId), req.body, req.auth);
            const editResult = await saveEdit(edit);
        }
        res.status(result.status).json({message:result.message});
    } catch (err) {
        res.status(500).json({error:err.stack});
    }
});
router.delete('/:bugId/test/:testId', isLoggedIn(), hasPermission('canDeleteTestCase'), 
validId('bugId'), validId('testId'), async (req, res) => {
    const bugId = req.bugId;
    const testId = req.testId;

    try {
        const result = await deleteTestById(bugId, testId);
        if (result.status == 200) {
            const edit = createEdit("Delete", "Testcase", newId(testId), null, req.auth);
            const editResult = await saveEdit(edit);
        }
        res.status(result.status).json({message:result.mesasge});
    } catch (err) {
        res.status(500).json({error:err.stack});
    }
});

export {router as TestRouter};