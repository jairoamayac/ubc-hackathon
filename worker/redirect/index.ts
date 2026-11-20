// The app's first address (house-money-ubc.jairoamayac.workers.dev) now forwards everything to kept.jairoamayac.workers.dev,
// keeping the path and query, so shared links and invite links (/?crew=...) keep working. 308 keeps POST as POST.
const TARGET = "https://kept.jairoamayac.workers.dev";

const redirect = {
  fetch(req: Request): Response {
    const url = new URL(req.url);
    return Response.redirect(TARGET + url.pathname + url.search, 308);
  },
};

export default redirect;
