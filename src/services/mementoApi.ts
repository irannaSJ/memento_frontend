const API_BASE_PATH = "/api/method/";

export interface ApiResponse<T> {
    success : true;
    data : T;
    message? : string;
    pagination?:PaginationInfo;
}

export interface PaginationInfo{
    start : number;
    page_length : number;
    returned : number;
    has_more : boolean;
    next_start : number | null;
}

export interface OperationCapabilities {
    can_read : boolean;
    can_create : boolean;
    can_update : boolean;
    can_delete : boolean;
}

export interface AvailableDocType {
    doctype : string;
    label : string;
    capabilities : OperationCapabilities
}

export type MetadataPurpose = 
  | "list"
  | "form"
  | "create"
  | "update"
  | "search";

export interface FieldMetadata {
    fieldname : string;
    label : string;
    fieldtype : string;
    required : boolean;
    read_only : boolean;
    hidden : boolean;
    description? : string;
    default? : unknown;
    length? : number;
    precision?:number;
    select_options?:string[];
    link_doctypes?:string;
    options_field?:string;
    child_doctype?:string;
}

export interface DocTypeMetadata {
  doctype: string;
  label: string;
  purpose: MetadataPurpose;
  fields: FieldMetadata[];
  capabilities: OperationCapabilities;
}

export type MementoRecord = {
  name: string;
  [fieldname: string]: unknown;
};

export interface RecordFilters {
  [fieldname: string]: unknown;
}

export interface GetRecordsParams {
  doctype: string;
  filters?: RecordFilters | unknown[];
  search?: string;
  start?: number;
  page_length?: number;
  order_by?: string;
}

export interface RecordCount {
  doctype: string;
  label: string;
  count: number;
}

export interface RecordMutationResult {
  doctype: string;
  name: string;
}



export interface UploadedFile {
  name: string
  file_name: string
  file_url: string
  is_private: number | boolean
  attached_to_doctype?: string | null
  attached_to_name?: string | null
}

export interface FileUploadContext {
  doctype: string
  docname: string
}


export class MementoApiError extends Error{
    readonly statusCode : number;
    readonly details : unknown;

    constructor(
        message : string,
        statusCode : number,
        details? : unknown
    ){
        super(message);
        this.name = "MementoApiError";
        this.statusCode = statusCode;
        this.details = details;
    }
}

type JsonObject = {
    [key : string] : unknown;
}

function isJsonObject(value : unknown):value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}


function getCsrfToken() : string | undefined {
    const frappeWindow = window as Window & {
        frappe? :{
            csrf_token? : string;
        };
    };

    const frappeToken = frappeWindow.frappe?.csrf_token;
    if (frappeToken){
        return frappeToken
    }
    const metaToken = document.querySelector<HTMLMetaElement>(
    'meta[name="csrf-token"]',
    )?.content;

    if (metaToken){
        return metaToken;
    }

    const csrfCookie = document.cookie
    .split(";")
    .find((cookie) => cookie.startsWith("csrf_token="));

    if(csrfCookie){
        const value = csrfCookie.substring("csrf_token=".length);

        try{
            return decodeURIComponent(value)
        }catch{
            return value
        }
    }

    return undefined
}

function extractServerMessage(body:unknown) : string | undefined
{
    if(!isJsonObject(body)){
        return undefined;
    }
    const rawMessage = body._server_messages;

    if(typeof rawMessage !== "string"){
        return undefined
    }
    try{
        const messages : unknown  = JSON.parse(rawMessage);
        if(!Array.isArray(messages)){
            return undefined;
        }
        for (const item of messages){
            let parsed:unknown = item;

            if(typeof item == "string"){
                try{
                    parsed = JSON.parse(item) as unknown;
                }catch{
                    if (item.trim()){
                        return item;
                    }

                    continue
                }
            }

            if (isJsonObject(parsed) && typeof parsed.message === "string"){
                return parsed.message;
            }
        }
    }catch{
        return undefined;
    }

    return undefined;
}

function extractErrorMessage (
    body : unknown,
    fallback : string
): string {
    if (typeof body === "string" && body.trim()){
        return body
    }

    if(!isJsonObject(body)){
        return fallback;
    }
    if (typeof body.message === "string" && body.message.trim()){
        return body.message
    }
    if(isJsonObject(body.message)){
        const nestedMessage = extractErrorMessage(body.message, "");

        if(nestedMessage){
            return nestedMessage;
        }
    }

    const serverMessage = extractServerMessage(body);
    if(serverMessage){
        return serverMessage;
    }

    if (typeof body._error_message === "string"){
        return body._error_message;
    }

    if (typeof body.exc_type === "string"){
        return `The request failed (${body.exc_type})`;
    }
    return fallback
}

function appendQueryParams(
    url : URL,
    args : object
):void {
    const query = new URLSearchParams();
    for (const [key,value] of Object.entries(args)){
        if (value === undefined || value === null){
            continue;
        }

        const serialized = 
        typeof value === "object"
        ? JSON.stringify(value)
        :String(value);

        if (serialized !== ""){
            query.set(key, serialized);
        }
    }

    url.search = query.toString();
}



//Reusable Function for Api's
async function request<T>(
    methodPath : string,
    httpMethod:"GET" | "POST",
    args : object = {}
): Promise<ApiResponse<T>> {
    const url = new URL(
        `${API_BASE_PATH}${methodPath}`,
        window.location.origin
    );

    if(httpMethod === "GET"){
        appendQueryParams(url, args);
    }
    const headers: Record<string, string> = {
        Accept : "application/json",
    };

    const options : RequestInit = {
        method :httpMethod,
        credentials : "include",
        headers,
    };

    if(httpMethod === "POST"){
        const csrfToken = getCsrfToken();
        if(csrfToken){
            headers["X-Frappe-CSRF-Token"] = csrfToken;
        }
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(args);
    }

    let response: Response;

    try{
        response = await fetch(url.toString(), options);
    }catch{
        throw new MementoApiError(
            "Unbale to connet to memento. check you connection and confirm that the Frappe server is running.",0,
        );
    }

    const responseText = await response.text();
    let body : unknown;
    if(responseText){
        try{
            body = JSON.parse(responseText) as unknown;
        }catch{
            body = responseText
        }
    }

    const result = isJsonObject(body) && "message" in body ? body.message : body;
    if (!response.ok){
        throw new MementoApiError(
            extractErrorMessage(
                body,
            `The Request failed with HTTP status ${response.status}`,
            ),
            response.status,
            body,
        );
    }

    if(!isJsonObject(result) || result.success !== true){
        throw new MementoApiError(
            extractErrorMessage(
                body,
                "memento returned an unexpected response.",
            ),
            response.status,
            body,
        );
    }

    return result as unknown as ApiResponse<T>;
}



//description options

async function uploadFileToFrappe(
  file: File,
  context: FileUploadContext,
): Promise<UploadedFile> {
  if (!context.doctype.trim() || !context.docname.trim()) {
    throw new MementoApiError(
      'Save the record before uploading images.',
      400,
    )
  }

  const formData = new FormData()

  formData.append('file', file)
  formData.append('doctype', context.doctype)
  formData.append('docname', context.docname)
  formData.append('is_private', '1')

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  const csrfToken = getCsrfToken()

  if (csrfToken) {
    headers['X-Frappe-CSRF-Token'] = csrfToken
  }

  let response: Response

  try {
    response = await fetch(
      `${window.location.origin}${API_BASE_PATH}upload_file`,
      {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      },
    )
  } catch {
    throw new MementoApiError(
      'Unable to upload the image. Check your connection and try again.',
      0,
    )
  }

  const responseText = await response.text()
  let body: unknown

  if (responseText) {
    try {
      body = JSON.parse(responseText) as unknown
    } catch {
      body = responseText
    }
  }

  if (!response.ok) {
    throw new MementoApiError(
      extractErrorMessage(
        body,
        `Image upload failed with HTTP status ${response.status}.`,
      ),
      response.status,
      body,
    )
  }

  const result =
    isJsonObject(body) && 'message' in body
      ? body.message
      : body

  if (
    !isJsonObject(result) ||
    typeof result.file_url !== 'string' ||
    typeof result.name !== 'string'
  ) {
    throw new MementoApiError(
      'Frappe uploaded the image but returned an unexpected response.',
      response.status,
      body,
    )
  }

  return result as unknown as UploadedFile
}


//public api methods

export const mementoApi = {
    getAvailableDocTypes() :Promise<ApiResponse<AvailableDocType[]>> {
        return request<AvailableDocType[]>(
            "memento.api_endpoints.metadata.get_available_doctypes",
            "GET",
        );
    },
    getDocTypeMetadata(
        doctype : string,
        purpose : MetadataPurpose = "form"
    ): Promise <ApiResponse<DocTypeMetadata>>{
        return request<DocTypeMetadata>(
            "memento.api_endpoints.metadata.get_doctype_metadata",
            "GET",
            {doctype, purpose}
        );
    },

    getDocTypeRecords(
        params: GetRecordsParams,
    ): Promise<ApiResponse<MementoRecord[]>> {
        return request<MementoRecord[]>(
        "memento.api_endpoints.records.get_doctype_records",
        "GET",
        params,
        );
    },

    getDocTypeRecord(
        doctype: string,
        name : string,
    ): Promise <ApiResponse<MementoRecord>>{
        return request<MementoRecord>(
            "memento.api_endpoints.records.get_doctype_record",
            "GET",
            {doctype,name}
        );
    },

    getDocTypeCount(
        doctype : string,
        filters? : RecordFilters,
        search?: string,
    ): Promise<ApiResponse<RecordCount>>{
        return request<RecordCount>(
            "memento.api_endpoints.records.get_doctype_count",
            "GET",
            {doctype,filters,search},
        );
    },

    createDocTypeRecord(
        doctype : string,
        data : RecordFilters,
    ): Promise<ApiResponse<RecordMutationResult>>{
        return request<RecordMutationResult>(
            "memento.api_endpoints.forms.create_doctype_record",
            "POST",
            {doctype,data}
        );
    },

    updateDocTypeRecord(
        doctype: string,
        name : string,
        data: RecordFilters,
    ): Promise<ApiResponse<RecordMutationResult>>{
        return request<RecordMutationResult>(
            "memento.api_endpoints.forms.update_doctype_record",
            "POST",
            {doctype,name,data},
        );
    },

    deleteDocTypeRecord(
        doctype:string,
        name :string,
    ): Promise<ApiResponse<RecordMutationResult>>{
        return request<RecordMutationResult>(
            "memento.api_endpoints.delete.delete_doctype_record",
            "POST",
            {doctype,name},
        );
    },


    uploadFile(
        file : File,
        context : FileUploadContext,
    ): Promise<UploadedFile>{
        return uploadFileToFrappe(file,context)
    }

}
