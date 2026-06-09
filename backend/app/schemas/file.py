from pydantic import BaseModel
from typing import Optional


class FileUploadResponse(BaseModel):
    file_path: str
    filename: str
    file_size: int
