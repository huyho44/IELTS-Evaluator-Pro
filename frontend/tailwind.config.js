/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Bạn có thể thêm mã màu chủ đạo từ Figma vào đây (ví dụ màu xanh IELTS)
        primary: '#0066FF',
      }
    },
  },
  plugins: [],
}
