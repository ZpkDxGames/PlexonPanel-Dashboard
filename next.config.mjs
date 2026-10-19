export default {
  devIndicators: false,
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.DefinePlugin({
        "import.meta.env": JSON.stringify({
          VITE_PLEXON_RELAY_URL:
            process.env.NEXT_PUBLIC_PLEXON_RELAY_URL ??
            process.env.VITE_PLEXON_RELAY_URL ??
            "",
        }),
      }),
    );
    return config;
  },
};
