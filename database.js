import debug from "debug";
import bcrypt from "bcrypt"
import { MongoClient, ObjectId } from 'mongodb';

const debugDb = debug("app:Database")
const newId = (str) => new ObjectId(str);
let _db = null;

async function connect() {
  if (!_db) {
    const connectionString = process.env.DB_URL;
    const dbName = process.env.DB_NAME;
    const client = await MongoClient.connect(connectionString);
    _db = client.db(dbName);
    debugDb('Connected to MongoDb');
  }
  return _db;
}
async function ping() {
  const db = await connect();
  await db.command({ ping: 1 });
}

//* USER FUNCTIONS
async function getUsers(pipeLine) {
    const db = await connect();
    const cursor = await db.collection("User").aggregate(pipeLine);
	const users = await cursor.toArray();
	if (users.length > 0) {
		return {
			status : 200,
			foundUsers : users,
			message : `Found ${users.length} users`
		};
	}
	return {
		status : 404,
		foundUsers : null,
		message : "No users found"
	};
}
async function getUserById(id) {
	const db = await connect();
	const user = await db.collection("User").findOne({_id: newId(id)}, { projection: { password: 0 } });
	if (user) {
		return {
			status : 200,
			foundUser : user,
			message : `Found user ${user.fullName}`
		};
	}
	return {
		status : 404,
		foundUser : null,
		message : `User with id ${id} not found`
	};
}
async function addNewUser(user) {
	const db = await connect();
    const emailExists =  await db.collection("User").findOne({email: user.email});
	if (typeof(user.role) == "string") {
		user.role = [user.role];
	}
	
	if(!emailExists) {
        user.password = await bcrypt.hash(user.password, 10);
        const result = await db.collection("User").insertOne(user);
        return {
            message: `Added ${user.fullName} with ID ${result.insertedId}`,
            status: 200
        };
    } else if (emailExists) {
        return {
            message: `User with email ${user.email} already exists`,
            status: 400
        };
    }
    return {
        message: `Failed to insert ${user.fullName}`,
        status: 400
    };
}
async function loginUser(userEmail, userPass) {
	const db = await connect();
	const user =  await db.collection("User").findOne({email: userEmail});
    if(user && await bcrypt.compare(userPass, user.password)) {
		delete user.password;
        return {
            message: `Welcome back ${user.fullName}!`,
            foundUser: user,
            status: 200 
        };
    }
    return {
        message: "Invalid credentials",
        foundUser: null,
        status: 404
    };
}
//? pass in null for req when you don't want to track lastUpdated, and lastUpdatedBy
async function updateUser(id, updatedUser, req) {
	const db = await connect();

	if(typeof(updatedUser.role) == "string")
		updatedUser.role = [updatedUser.role];
	
	const result = await db.collection("User").updateOne({_id:newId(id)}, {$set:{...updatedUser}});

    if (result.modifiedCount > 0) {
        return {
            message: `User with id ${id} been updated`,
            status: 200
        };
    }
    return {
        message: `Failed to update user with id ${id}`,
        status: 404
    };
}
async function deleteUser(id) {
	const db = await connect();
	const result =  await db.collection("User").deleteOne({_id: newId(id)});
	if (result.deletedCount > 0) {
        return {
            message: `User with id ${id} been deleted`,
            status: 200
        };
    }
    return {
        message: `Failed to delete user with id ${id}`,
        status: 404
    };
}

//* BUG FUNCTIONS
async function getBugs(pipeline) {
	const db = await connect();
    const cursor = await db.collection("Bug").aggregate(pipeline);
	const bugs = await cursor.toArray();
    if (bugs.length > 0) {
		return {
			status : 200,
			foundBugs : bugs,
			message : `Found ${bugs.length} users`
		};
	}
	return {
		status : 404,
		foundBugs : null,
		message : "No users found"
	};
}
async function getBugById(id) {
	const db = await connect();
	const bug = await db.collection("Bug").findOne({_id: newId(id)});
	if (bug) {
		return {
			status : 200,
			foundBug : bug,
			message : `Found bug ${bug.title}`
		};
	}
	return {
		status : 404,
		foundBug : null,
		message : `Bug with id ${id} not found`
	};
}
async function addNewBug(newBug) {
	const db = await connect();
	if (typeof(newBug.stepsToReproduce) == "string") {
		newBug.stepsToReproduce = [newBug.stepsToReproduce];
	}
	newBug.dateCreated = new Date();
	const result = await db.collection("Bug").insertOne(newBug);
    if (result.acknowledged == true) {
		return {
			message: `Added ${newBug.title} with ID ${result.insertedId}`,
			bug : newBug,
			status: 200
		};
	}
	return {
		message: `Failed to add ${newBug.title}`,
		bug : null,
		status: 400
	};
}
async function updateBugById(id, updatedBug, req) { 
	const db = await connect();
	const bug = (await getBugById(id)).foundBug;
	if (req != null) {
		updatedBug["update.lastUpdated"] = new Date();
    	updatedBug["update.lastUpdatedBy"] = (await getUserById(req.auth._id)).foundUser.fullName;
	}
	if (bug?.assignedInfo?.assignedToUserId != newId(req.auth._id) && !req.auth.role.includes('business analyst')) {
		return {
            message: `Only business analysts can edit bugs others are assigned to`,
            status: 400
        };
	}
	if (bug.createdBy.user_id != newId(req.auth._id) && !req.auth.role.includes('business analyst')) {
		return {
            message: `Only business analysts can edit others bugs`,
            status: 400
        };
	}
	const result = await db.collection("Bug").updateOne({_id:newId(id)},{$set:{...updatedBug}});
	if (result.modifiedCount > 0) {
        return {
            message: `Bug with id ${id} been updated`,
            status: 200
        };
    }
    return {
        message: `Failed to update bug with id ${id}`,
        status: 404
    };
}
async function classifyBug(id, classified, auth) {
	const db = await connect();
	const selectedBug = (await getBugById(id)).foundBug;
	let result;

	if (!selectedBug) {
		return {
			status : 404,
			foundBug : null,
			message : `Bug with id ${id} not found`
		};
	}
	if (bug?.assignedInfo?.assignedToUserId != newId(auth._id) && !auth.role.includes('business analyst')) {
		return {
            message: `Only business analyst can classify bugs others are assigned to`,
            status: 400
        };
	}
	if (selectedBug.createdBy.user_id != newId(auth._id) && !auth.role.includes('business analyst')
		&& bug?.assignedInfo?.assignedToUserId != newId(auth._id)) {
		return {
            message: `Only business analyst can classify others bugs`,
            status: 400
        };
	}

	if (selectedBug['classification']['classifiedOn'] == undefined) {
		result = await db.collection("Bug").updateOne({_id:newId(id)}, {$set:{classification:{classifiedOn:new Date(),
			lastUpdated:new Date(), classifiedAs:classified, classifiedBy:auth}}});
	}else
	{
		result = await db.collection("Bug").updateOne({_id:newId(id)}, {
		$set:{"classification.classifiedAs":classified, "classification.lastUpdated":new Date(),
		"classification.classifiedBy":auth}});
	}
	if (result.modifiedCount == 1) {
		return {
			status : 200,
			message : `${selectedBug.title} classified`
		};
	}
	return {
		status : 400,
		message : `Failed to classify ${selectedBug.title}`
	};
}
async function assignBug(userId, bugId, auth) {
	const db = await connect();
	const bug = (await getBugById(bugId)).foundBug;
	const assignedUser = (await getUserById(userId)).foundUser;

	if (!assignedUser) {
		return {
			status : 404,
			message : `User ${userId} not found`
		};
	}
	if (bug?.assignedInfo?.assignedToUserId != newId(auth._id) && !auth.role.includes('business analyst')) {
		return {
            message: `Only business analysts can edit bugs others are assigned to`,
            status: 400
        };
	}
	if (bug.createdBy.user_id != newId(auth._id) && !auth.role.includes('business analyst') &&
		bug?.assignedInfo?.assignedToUserId != newId(auth._id)) {
		return {
            message: `Only business analysts can edit others bugs`,
            status: 400
        };
	}
	const result = await db.collection("Bug").updateOne({_id:newId(bugId)}, {$set:{assignedInfo:{assignedToUserId:newId(userId),
		assignedToName:assignedUser.fullName,assignedOn:new Date(), lastUpdated:new Date()}}});
	if (result.acknowledged == true) {
		return {
			status : 200,
			foundUser : assignedUser,
			message : `Assigned User ${userId} to ${bugId};`
		};
	}
	return {
		status : 400,
		foundUser : null,
		message : `Failed to assign user ${userId} to bug ${bugId};`
	};
}
async function closeBug(id, isClosed, auth) {
	const db = await connect();
	const bugToClose = (await getBugById(id)).foundBug;
	const closedBy = (await getUserById(auth._id)).foundUser;
	let result;
	if (!bugToClose) {
        return {
			status : 404,
			message : `Bug ${id} not found`
		};
    }
	if (isClosed) {
		result = await db.collection("Bug").updateOne({_id:newId(id)}, {$set:{closedInfo:{
			closed:isClosed, closedOn:new Date(), closedBy: closedBy, lastUpdated: new Date()
		}}});
		return {
			status : 200,
			message : `Bug ${id} has been closed`
		};
	} else {
		result = await db.collection("Bug").updateOne({_id:newId(id)}, {$set:{
			"closedInfo.closed":isClosed, "closedInfo.clsoedBy":closedBy, "closedInfo.lastUpdated": new Date()
		}});
		return {
			status : 200,
			message : `Bug ${id} has been opened`
		};
	}
}

//* BUG COMMENT FUNCTIONS
async function getCommentsForBug(bugId) {
	const db = await connect();
	const comments = db.collection("Comment").find({bug_id: newId(bugId)}).toArray();
	if (comments) {
		return comments;
	} else {
		return "Bug has no comments";
	}
	
}
async function getCommentById(bugId, commentId) {
	const db = await connect();
	const comment = db.collection("Comment").findOne({_id:newId(commentId),bug_id:newId(bugId)});
	return comment ? comment : 'Comment not found';
}
async function addCommentToBug(bugId, comment, auth) {
	const db = await connect();
	const commentor = (await getUserById(auth._id)).foundUser;

	return db.collection("Comment").insertOne({text:comment.text, author:commentor.fullName, 
		author_id:commentor._id, bug_id:bugId, date:new Date()});
}

//* BUG TEST CASE FUNCTIONS
async function getTestsForBug(bugId) {
	const db = await connect();
	const selectedBug = await getBugById(bugId);
	if (selectedBug) {
		const tests = db.collection("Testcase").find({bug_id: selectedBug._id}).toArray();
		if (tests.length > 0) {
			return tests;
		} else {
			return "Bug has no tests";
		}
	} else {
		return `Bug ${bugId} not found`;
	}
	
}
async function getTestById(bugId, testId) {
	const db = await connect();
	const comment = db.collection("Testcase").findOne({_id:newId(testId),bug_id:newId(bugId)});
	return comment ? comment : 'Test not found';
}
async function addTestToBug(bugId, newTest, auth) {
	const db = await connect();
	const addingUser = (await getUserById(auth._id)).foundUser;

	const result = await db.collection("Testcase").insertOne({status:newTest.status, bug_id:bugId, 
		dateCreated:new Date(), createdBy:addingUser.fullName});
	if (result.acknowledged == true) {
		return {
			status : 200,
			message : "Successfully added test to bug",
			insertedId : result.insertedId
		};
	}
	return {
		status : 400,
		message : "Failed to add test to bug",
		insertedId : null
	};
}
async function updateTestById(bugId, testId, updatedTest, auth) {
	const db = await connect();
	const userUpdating = (await getUserById(auth._id)).foundUser;
	const result = await db.collection("Testcase").updateOne({_id:newId(testId), bug_id:newId(bugId)}, 
	{$set:{status:updatedTest.status, "update.lastUpdated":new Date(), 
	"update.lastUpdatedBy":userUpdating.fullName}});
	if (result.acknowledged == true) {
		return {
			status : 200,
			message : "Successfully updated test"
		};
	}
	return {
		status : 400,
		message : "Failed to update test"
	};
}
async function deleteTestById(bugId, testId) {
	const db = await connect();

	const result = await db.collection("Testcase").deleteOne({_id:newId(testId), bug_id:newId(bugId)});

	if (result.acknowledged == true) {
		return {
			status : 200,
			mesasge : "Successfully deleted test"
		};
	}
	return {
		status : 400,
		mesasge : "Failed to delete test"
	};
}

//* EDIT FUNCTIONS
function createEdit(op, col, target, updated, auth) {
    return {
        dateEdited : new Date(),
        operation : op,
        collection : col,
        target : target,
        update : updated,
		auth : auth
    };
}
async function saveEdit(edit) {
    const db = await connect();
    const result = await db.collection("Edit").insertOne(edit);
    if(result.acknowledged == true) {
        return {
            message : `Completed the ${edit.collection} ${edit.operation}!`,
            status : 200
        };
    }
    return {
        message : `Failed to edit! ${edit.collection}`,
        status : 400
    };
}

async function findRoleByName(name) {
    const db = await connect();
    const role = await db.collection("Role").findOne({name:name});
    return role;
}
export {connect, newId};
export {getUsers, getUserById, addNewUser, loginUser, updateUser, deleteUser};
export {getBugs, getBugById, addNewBug, updateBugById, classifyBug, assignBug, closeBug};
export {getCommentsForBug, getCommentById, addCommentToBug};
export {getTestsForBug, getTestById, addTestToBug, updateTestById, deleteTestById};
export {createEdit, saveEdit};
export {findRoleByName};