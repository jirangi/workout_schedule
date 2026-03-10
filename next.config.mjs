/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',               // 정적 HTML 내보내기 활성화
  basePath: '/workout_schedule',  // GitHub 레포지토리 이름
  assetPrefix: '/workout_schedule',
  images: { unoptimized: true },  // 정적 배포 시 필수
};

export default nextConfig;
