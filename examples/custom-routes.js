/**
 * Example programmatic JS mock endpoints with custom logic and handlers.
 */

export default {
  prefix: '/custom',
  routes: [
    {
      method: 'GET',
      path: '/dynamic-calculator',
      handler: (req) => {
        const a = parseFloat(req.query.a || '0');
        const b = parseFloat(req.query.b || '0');
        const op = req.query.op || 'add';

        let result = 0;
        if (op === 'add') result = a + b;
        else if (op === 'multiply') result = a * b;
        else if (op === 'subtract') result = a - b;

        return {
          status: 200,
          headers: { 'X-Calculator-Engine': 'Custom-JS' },
          body: { a, b, op, result }
        };
      }
    },
    {
      method: 'POST',
      path: '/echo',
      handler: (req) => {
        return {
          status: 200,
          body: {
            receivedHeaders: req.headers,
            receivedBody: req.body,
            receivedQuery: req.query
          }
        };
      }
    }
  ]
};
