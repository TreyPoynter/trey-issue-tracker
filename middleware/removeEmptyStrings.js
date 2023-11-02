const removeEmptyStrings = (paramName) => {
    return (req, res, next) => {
        if (req.body[paramName] && Array.isArray(req.body[paramName])) {
            req.body[paramName] = req.body[paramName]
            .filter(item => typeof(item) === 'string' && item.trim() !== '');
        }
        next();
    };
};

export {removeEmptyStrings};