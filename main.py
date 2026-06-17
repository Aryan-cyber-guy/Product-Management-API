from fastapi import Depends,FastAPI, HTTPException
from models import Products, ProductCreate, ProductUpdate
from database import session,engine
import db_models
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
import os
from contextlib import asynccontextmanager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_models.Base.metadata.create_all(bind=engine)
@app.get("/")
def greet():
    return "Server is running"

def get_db():
    db = session()
    try:
        yield db
    finally:
        db.close()

@app.get("/products", response_model=list[Products])
def all_products(db: Session = Depends(get_db)):
    db_products = db.query(db_models.ProductSchema).all()
    return db_products

@app.get("/products/{id}", response_model=Products)
def product(id:int,db: Session = Depends(get_db)):
    db_product = db.query(db_models.ProductSchema).filter(db_models.ProductSchema.id == id).first()
    if db_product:
        return db_product
    raise HTTPException(status_code=404, detail="Product not found")

@app.post("/products", response_model=Products)
def add_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = db_models.ProductSchema(**product.model_dump())

    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    return db_product

@app.put("/products/{id}", response_model=Products)
def update_product(id: int, product: ProductUpdate, db: Session = Depends(get_db)):
    db_product = db.query(db_models.ProductSchema).filter(db_models.ProductSchema.id == id).first()

    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_product, field, value)

    db.commit()
    db.refresh(db_product)

    return db_product

@app.delete("/products/{id}")
def delete_product(id:int, db: Session = Depends(get_db)):
    db_product = db.query(db_models.ProductSchema).filter(db_models.ProductSchema.id == id).first()
    if db_product:
        db.delete(db_product)
        db.commit()
        return db_product
    raise HTTPException(status_code=404, detail="Product not found")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)