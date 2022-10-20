from cryptography.fernet import Fernet

DB_SECRET_KEY = Fernet.generate_key()
print("////////////////////////////")
print("HERE IS YOUR NEW SECRET KEY: " + str(DB_SECRET_KEY, encoding="utf-8"))
print("////////////////////////////")
