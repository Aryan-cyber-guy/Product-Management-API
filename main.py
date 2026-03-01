from fastapi import Depends,FastAPI
from models import Products
from database import session,engine
import db_models
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
import os

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
    return "Hello every nyaan"

products = [
    Products(id=1,name="Laptop",description="A laptop pc",price=899,quantity=5),
    Products(id=2,name="Phone",quantity=2,description="Smart Phone",price=999),
    Products(id=3,name="TV",quantity=8,description="OLED",price=1299),
    Products(id=5,name="Tablet",quantity=2,description="Nice one",price=899)
]

def get_db():
    db = session()
    try:
        yield db
    finally:
        db.close()

def init_db():
    db = session()
    count = db.query(db_models.Products).count()
    if count==0:
        for product in products:
            db.add(db_models.Products(**product.model_dump()))
        db.commit()

init_db()

@app.get("/products")
def all_products(db: Session = Depends(get_db)):
    db_products = db.query(db_models.Products).all()
    return db_products

@app.get("/products/{id}")
def product(id:int,db: Session = Depends(get_db)):
    db_product = db.query(db_models.Products).filter(db_models.Products.id == id).first()
    if db_product:
        return db_product
    return "Product not found"

@app.post("/products")
def add_product(product: Products,db: Session = Depends(get_db)):
    db.add(db_models.Products(**product.model_dump()))
    db.commit()
    return product

@app.put("/products/{id}")
def update_product(id:int ,product: Products,db: Session = Depends(get_db)):
    db_product = db.query(db_models.Products).filter(db_models.Products.id == id).first()
    if db_product:
        db_product.name = product.name
        db_product.price = product.price
        db_product.description = product.description
        db_product.quantity = product.quantity
        db.commit()
        db.refresh(db_product)
        return db_product
    return {"error":"Product not found"}

@app.delete("/products/{id}")
def delete_product(id:int,db: Session = Depends(get_db)):
    db_product = db.query(db_models.Products).filter(db_models.Products.id == id).first()
    if db_product:
        db.delete(db_product)
        db.commit()
        return db_product
    return "Product not found"

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)