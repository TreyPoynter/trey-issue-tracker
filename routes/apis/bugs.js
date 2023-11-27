import express from 'express';
import {getBugs, getBugById, addNewBug, updateBugById, classifyBug, assignBug, closeBug,
createEdit, saveEdit, newId} from '../../database.js';
import debug from 'debug';
import {validId} from '../../middleware/validId.js';
import {validBody} from '../../middleware/validBody.js';
import Joi from 'joi';
import  Jwt from "jsonwebtoken";
import {isLoggedIn, hasPermission} from "@merlin4/express-auth";
import { ObjectId } from 'mongodb';

const newBugSchema = Joi.object({
    title: Joi.string().trim().required(),
    description: Joi.string().trim().required(),
    stepsToReproduce: Joi.string().trim().required()
});
const updateBugSchema = Joi.object({
    title: Joi.string().trim(),
    description: Joi.string().trim(),
    classification: {classifiedAs: Joi.string().trim()},
    stepsToReproduce: Joi.array().items(Joi.string().trim())
});
const classifySchema = Joi.object({
    classification: Joi.string().lowercase().valid('approved', 'unapproved', 'duplicate', 'unclassified')
});
const closeSchema = Joi.object({
    closed: Joi.boolean().required()
});
const router = express.Router();
const debugBug = debug('app:BugRouter');

router.use(express.urlencoded({extended:false}));

//* GET all bugs
router.get('/list', isLoggedIn(), hasPermission('canViewData'), async (req, res) => {
    let {keywords, classification, minAge, maxAge, closed, sortBy, pageSize, pageNum} = req.query;
    let sort = {newest:1};
    const match = {};

    //? Filter through the requested queries
    if (keywords) {
        match.$text = {$search:keywords};
    }
    if (classification) {
        match['classification.classifiedAs'] = classification;
    }
    if (closed) {
        const searchClosed = (closed.toLowerCase() === 'true');
        match['closedInfo.closed'] = searchClosed;
    }
    const today = new Date();
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);
    today.setMilliseconds(0);

    const pastMaximumDaysOld = new Date(today);
    pastMaximumDaysOld.setDate(pastMaximumDaysOld.getDate() - maxAge); // Set pastMaximumDaysOld to today minus maxAge
    const pastMinimumDaysOld = new Date(today);
    pastMinimumDaysOld.setDate(pastMinimumDaysOld.getDate() - minAge); // Set pastMinimumDaysOld to today minus minAge

    if(maxAge && minAge) {
      match.dateCreated = {$lte:pastMinimumDaysOld, $gte:pastMaximumDaysOld};
    } else if(minAge) {
      match.dateCreated = {$lte:pastMinimumDaysOld};
    } else if(maxAge) {
      match.dateCreated = {$gte:pastMaximumDaysOld};
    }

    switch (sortBy) {
        case 'newest': sort = {dateCreated:-1}; break;
        case 'oldest': sort = {dateCreated:1}; break;
        case 'title': sort = {title:1, dateCreated:-1}; break;
        case 'classification': sort = {"classification.classifiedAs":1, dateCreated:-1}; break;
        case 'assignedTo': sort = {"assignedInfo.assignedToName":1, dateCreated:-1}; break;
        case 'createdBy': sort = {"createdBy.name":1, dateCreated:-1}; break;
    }

    pageNum = parseInt(pageNum) || 1;
    pageSize = parseInt(pageSize) || 5;
    const skip = (pageNum-1)*pageSize;
    const limit = pageSize;
    debugBug(`The match object is ${JSON.stringify(match)}`);
    const pipeline = [
        {$match: match},
        {$sort: sort},
        {$skip: skip},
        {$limit: limit}
    ];
    try{
        const bugs = await getBugs(pipeline);
        res.status(bugs.status).json(bugs.foundBugs);
    }catch(err){
        res.status(500).json({error: err.stack});
    }
});
//* GET bug by id
router.get('/:bugId', isLoggedIn(), hasPermission('canViewData'), validId("bugId"), async (req, res) => {
    const bugId = req.bugId;  // reads bugId from URL and stores it
    try {
        const bug = await getBugById(bugId);
        res.status(bug.status).json(bug.foundBug);
    } catch (err) {
        res.status(500).json({error:err.stack});
    }
    
});
//* PUT new bug
router.put('/new', isLoggedIn(), hasPermission('canCreateBug'), validBody(newBugSchema), async (req, res) => {
    const newBug = {
        _id : newId(),
        dateCreated : new Date(),
        ...req.body,
        classification : {
            classifiedAs : "unclassified",
        },
        closedInfo : {
            closed : false
        },
        createdBy : {
            name : req.auth.name,
            user_id : newId(req.auth._id)
        }
    };

    try {
        const result = await addNewBug(newBug);
        if (result.status == 200) {
            const edit = createEdit("Insert", "Bug", result.bug._id, result.bug, req.auth)
            await saveEdit(edit);
        }
        res.status(result.status).json({message:result.message});
    } catch (err) {
        res.status(500).json({error:err.stack});
    }
    
    
});
//* Update bug with id
router.put('/:bugId', isLoggedIn(), hasPermission('canEditAnyBug', 'canEditIfAssignedTo', 'canEditMyBug'), 
validId("bugId"), validBody(updateBugSchema), async (req, res) => {
    const id = req.bugId;
    const updatedBug = req.body;
    debugBug('ROUTER HIT');

    try {
        const updateResult = await updateBugById(id, updatedBug, req);
        delete updatedBug['update.lastUpdated'];
        delete updatedBug['update.lastUpdatedBy'];
        if (updateResult.status == 200) {
            const edit = createEdit("Update", "Bug", newId(id), req.body, req.auth);
            const editResult = await saveEdit(edit);
        }
        res.status(updateResult.status).json({message: updateResult.message});
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});
//* Classify a bug
router.put('/:bugId/classify', isLoggedIn(), hasPermission('canClassifyAnyBug'), 
validId("bugId"), validBody(classifySchema), async (req, res) => {
    const id = req.params.bugId;
    const classification = req.body.classification;

    if (!classification) {
        res.status(400).json({error:'Must enter a classification'});
    } else {
        try {
            const result = await classifyBug(id, classification, req.auth);
            if (result.status == 200) {
                const edit = createEdit("Update", "Bug", newId(id), req.body, req.auth);
                const editResult = await saveEdit(edit);
            }
            res.status(result.status).json({message: result.message});
        } catch (err) {
            res.status(500).json({error: err.stack});
        }
    }
    
});
router.put('/:bugId/assign', isLoggedIn(), hasPermission('canReassignAnyBug'), validId("bugId"), async (req, res) => {
    const id = req.bugId;
    const userId = req.body.assignedUserId;

    try {
        const result = await assignBug(userId, id, req.auth);
        if (result.status == 200) {
            const edit = createEdit("Update", "Bug", newId(id), {
                assignedToUserId : newId(userId),
                assignedToName : result.foundUser.fullName
            }, req.auth);
            const editResult = await saveEdit(edit);
        }
        res.status(result.status).json({message:result.message});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});
router.put('/:bugId/close', isLoggedIn(), hasPermission('canCloseAnyBug'), 
validId("bugId"), validBody(closeSchema), async (req, res) => {
    const id = req.bugId;
    const isClosed = req.body.closed;
    try {
        const closingResult = await closeBug(id, isClosed, req.auth);
        if (closingResult.status == 200) {
            const edit = createEdit("Update", "Bug", newId(id), req.body, req.auth);
            const editResult = await saveEdit(edit);
        }
        res.status(closingResult.status).json({message:closingResult.message});
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});

export {router as BugRouter};
