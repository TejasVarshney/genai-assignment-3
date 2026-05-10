export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

export function errorResponse(error) {
  console.error(error);
  return json(error.statusCode || error.status || 500, {
    error: error.message || "Something went wrong while processing the request."
  });
}
