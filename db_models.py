from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, String, Integer, Float

Base = declarative_base()

class ProductSchema(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(String)
    price = Column(Float)
    quantity = Column(Integer)