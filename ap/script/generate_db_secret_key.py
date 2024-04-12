from cryptography.fernet import Fernet

print("////////////////////////////")
print("HERE IS YOUR NEW SECRET KEY: " + str(Fernet.generate_key(), encoding="utf-8"))
print("////////////////////////////")
