interface IStatus {
  code: number;
  status: string;
}

interface IHttpStatus {
  OK: IStatus;
  CREATED: IStatus;
  NO_CONTENT: IStatus;
  BAD_REQUEST: IStatus;
  NOT_FOUND: IStatus;
  INTERNAL_SERVER_ERROR: IStatus;
  WARNING: IStatus;
  UN_AUTHORISED:IStatus;
  DATABASE_ERROR :IStatus;
  CONFLICT:IStatus;
  PAYLOAD_TOO_LARGE: IStatus;
}

const HttpStatus: IHttpStatus = {
  OK: {code: 200, status: "OK"},
  CREATED: {code: 201, status: "CREATED"},
  NO_CONTENT: {code: 204, status: "NO_CONTENT"},
  BAD_REQUEST: {code: 400, status: "BAD_REQUEST"},
  NOT_FOUND: {code: 404, status: "NOT_FOUND"},
  INTERNAL_SERVER_ERROR: {code: 500, status: "INTERNAL_SERVER_ERROR"},
  WARNING: {code: 200, status: "WARNING"},
  DATABASE_ERROR :{code:502,status :"DATABASE_ERROR"},
  UN_AUTHORISED: {code: 401, status: "ALERT"},
  CONFLICT: {code: 409, status: "CONFLICT"},
  PAYLOAD_TOO_LARGE: {code: 413, status: "CONTENT_TOO_LARGE"}
}

export default HttpStatus;
