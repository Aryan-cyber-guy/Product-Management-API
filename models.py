from pydantic import BaseModel, ConfigDict

class Products(BaseModel):
    id: int
    name: str
    description: str
    price: float
    quantity: int

    model_config = ConfigDict(from_attributes=True)

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    quantity: int


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = None
    quantity: int | None = None