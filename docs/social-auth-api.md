
# API Đăng nhập Google & Facebook

## 1. Đăng nhập với Google

### Endpoint

```
GET /api/v1/auth/google
```

### Quy trình
1. Người dùng truy cập endpoint trên hoặc nhấn nút "Đăng nhập với Google" trên frontend.
2. Hệ thống sẽ chuyển hướng người dùng đến trang xác thực Google.
3. Sau khi xác thực thành công, Google sẽ chuyển hướng về:
   ```
   http://localhost:8000/api/v1/auth/google/callback
   ```
4. Backend sẽ nhận thông tin profile từ Google, tạo hoặc lấy user, sinh accessToken/refreshToken và trả về thông tin user + token.

### Dữ liệu trả về (ví dụ)
```json
{
  "user": { ... },
  "tokens": { ... }
}
```

### Lưu ý
- Nếu tài khoản chưa tồn tại, hệ thống sẽ tự động tạo mới user với thông tin từ Google.
- Nếu tài khoản bị khóa (`isActive: false`), trả về lỗi 401.


## 2. Đăng nhập với Facebook

### Endpoint
```
GET /api/v1/auth/facebook
```

### Quy trình
1. Người dùng truy cập endpoint trên hoặc nhấn nút "Đăng nhập với Facebook" trên frontend.
2. Hệ thống sẽ chuyển hướng người dùng đến trang xác thực Facebook.
3. Sau khi xác thực thành công, Facebook sẽ chuyển hướng về:
   ```
   http://localhost:8000/api/v1/auth/facebook/callback
   ```
4. Backend sẽ nhận thông tin profile từ Facebook, tạo hoặc lấy user, sinh accessToken/refreshToken và trả về thông tin user + token.

### Dữ liệu trả về (ví dụ)
```json
{
  "user": {
    "id": "1",
    "email": "test@example.com",
    "username": "Test User",
    "role": "USER"
  },
  "tokens": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "csrfToken": "uuid"
  }
}
```

### Lưu ý
- Nếu tài khoản chưa tồn tại, hệ thống sẽ tự động tạo mới user với thông tin từ Facebook.
- Nếu tài khoản bị khóa (`isActive: false`), trả về lỗi 401.

---

## 3. Thông tin trả về từ Google/Facebook

- `socialId`: ID của tài khoản Google/Facebook.
- `email`: Email xác thực từ Google/Facebook.
- `name`: Tên hiển thị.
- `avatar`: Ảnh đại diện (nếu có).
- `provider`: `google` hoặc `facebook`.
- `accessToken`, `refreshToken`: Token xác thực của hệ thống.

---

## 4. Lưu ý kỹ thuật
