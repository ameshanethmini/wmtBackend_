export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = source === 'body' ? req.body : req.query;
    const { error, value } = schema.validate(data, { abortEarly: false });
    if (error) {
      console.warn(
        `[${new Date().toISOString()}] VALIDATION FAILED ${req.method} ${req.originalUrl}`,
        error.details.map((d) => ({ path: d.path.join('.'), message: d.message }))
      );
      return res.status(400).json({
        error: 'Request payload is invalid.',
      });
    }
    if (source === 'body') req.body = value;
    else req.query = value;
    next();
  };
}
