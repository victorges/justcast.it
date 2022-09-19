# justcast.it

1-click live streaming from a web app.

## Contributing

Pull Requests are always welcome! Also feel free to just open issues if you
don't have the time to figure it out or have problems getting started.

### Setup

1. Install [Node.js](https://nodejs.org/en/download/) and [Yarn](https://yarnpkg.com/en/docs/install).
2. Clone the repository.
3. Run `yarn` to install all the project dependencies.
   - Make sure you have [`rsync`](https://formulae.brew.sh/formula/rsync)
     available as well. This is the biggest tech debt on the build pipeline as
     we only use it for copying some files around (PRs welcome!).
4. Run `yarn build` to make sure you can build the project.

### Running the app

1. Access [the Livepeer Studio dashboard and create an API key](https://docs.livepeer.studio/quickstart/#create-api-key).
2. Create a `.env` file in the root of the project with the following content:
   ```bash
   LIVEPEER_API_KEY={{ API key from the step above }}
   ```
3. Run `yarn start` to start the web server and access it on `http://localhost:8080`.

To build the docker image you can also run `yarn docker:build` and then `yarn docker:start` to start it locally, accessing it on the same endpoint. The docker
compose deployment will automatically pickup the env from the `.env` file as
well.

### Development

For quicker development cycles, you can run `yarn watch` to recompile and reload
the server any time you make a change to the source code.

The current architecture is as vanilla as possible, with static files served by
the same web server that serves the API. This allows for the most lightweight
experience possible, but also means that you can't use any fancy features like
hot module reloading. If you want to work on the frontend, you'll have to reload
the page manually.

That also means that deploying this project is as simple as running a docker
container, but on the other hand we can't use higher-level development platforms
like Vercel very easily.

## Deployment

To deploy the project, you only need to run the Docker container in a publicly
accessible endpoint and with access to a Livepeer API key in the environment
variables. It can even be the same one that you use for dev, but it's
recommended to create a new one for production.

The pre-built docker container is also publicly available on Docker Hub in the
[`victorges/justcast.it`](https://hub.docker.com/repository/docker/victorges/justcast.it)
repository.

So TL;DR, all you need to do is:

- Decide on a platform where you want to run your container (e.g. Fly.io,
  Google Cloud, Okteto, Heroku, Azure, AWS...)
- Deploy a container with the image `victorges/justcast.it:latest`
- Set an environment variable called `LIVEPEER_API_KEY` with your API key.
  Ideally this should be a "secret" value, each provider will have their own
  abstractions for this
- Access it from a public URL (this also changes per provider)

### Cloud Providers

#### [fly.io](https://fly.io/)

This app is currently deployed through [fly.io](https://fly.io/). It provides
the best and easiest experience for simply running a container with a public
endpoint. It also has a free tier, but you do need to set up a credit card on
sign-up.

Since we already have the configuration files for it, after configuring your
`flyctl` CLI:

- Create an app on your account (you'll choose or get a random app name):
  ```bash
  flyctl apps create
  ```
- Create a secret with your Livepeer API key:
  ```bash
  flyctl secrets set --app {{ your app name }} LIVEPEER_API_KEY={{ your API key }}
  ```
- Deploy the app:
  ```bash
  flyctl deploy --config ops/fly.toml --app {{ your app name }}
  ```

#### [Okteto](https://cloud.okteto.com/)

This is a good alternative if you're not willing to put your credit card
information anywhere. It is slightly more expensive though if you don't want
your apps sleeping automatically after a while without deploys.

It also supports the Docker Compose syntax for deployment, which we do have in
the root of the project. You will only need to add an `endpoints` config to
expose the service on the internet via HTTPS. Check [this
commit](https://github.com/victorges/justcast.it/pull/42/commits/41f4f812e2e2f5b64d60b747385429b617d43786)
for an example of when this app was deployed there.

#### [Google Cloud Run](https://cloud.google.com/run)

Google Cloud is actually a pretty good option as well and really easy to use.
Although it might be a little more bureaucratic, you can also save a lot of
money on the infra bill since your app can automatically sleep when it's not in
use. Follow [this](https://cloud.google.com/run/docs/deploying) for a quick
guide.

The biggest problem is that it doesn't run images from Docker Hub. So you'll
need to push the images to the Google Container Registry and only then deploy it
on Cloud Run. See [this StackOverflow
answer](https://stackoverflow.com/a/66324319) for more details.

## Contact

Feel free to open an issue to start a discussion or just chat on Discord
(victorges#0420).

## License

MIT
