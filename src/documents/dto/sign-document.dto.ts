

export class SignDocumentDto {
    pdfBuffer: Buffer
    signatures: Signature[];
}

// TODO: Evaluar poder traer coordinadas del frontend (x, y)
export class Signature {
    signature: Buffer;
    placeholder: string;
}
