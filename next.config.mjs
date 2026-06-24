/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */

  async rewrites() {
    return [
      // Some deployments only route /systems/* through the reverse proxy.
      // Re-map TinyMCE assets under /systems to the public /tinymce directory.
      {
        source: '/systems/tinymce/:path*',
        destination: '/tinymce/:path*',
      },
    ];
  },
};

export default nextConfig;
