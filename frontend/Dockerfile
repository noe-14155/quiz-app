# Étape 1 : construire les fichiers statiques (npm run build)
FROM node:20-slim AS build
WORKDIR /app
# VITE_API_BASE_URL est un ARGUMENT DE BUILD, pas une variable d'exécution :
# Vite l'inscrit dans le bundle au moment du build. La changer impose donc de
# reconstruire l'image, pas seulement de redémarrer le conteneur.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape 2 : servir ces fichiers statiques via nginx (image finale, légère)
FROM nginx:alpine
# Configuration maison : repli SPA + politique de cache (voir nginx.conf).
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
