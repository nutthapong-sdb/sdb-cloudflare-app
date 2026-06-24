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
      // Proxy VNC traffic internally so it works through Cloudflare Tunnel without exposing external ports
      {
        source: '/vnc',
        destination: `http://chrome-browser:5800/`,
      },
      {
        source: '/vnc/:path*',
        destination: `http://chrome-browser:5800/:path*`,
      },
    ];
  },
};

export default nextConfig;
