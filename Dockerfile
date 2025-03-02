#FROM debian:12-slim AS build
FROM python:3.9-slim AS build
RUN apt-get update && \
    apt-get install --no-install-suggests --no-install-recommends --yes python3-venv gcc libpython3-dev && \
    python3 -m venv /venv && \
    /venv/bin/pip install --upgrade pip setuptools wheel

# Build the virtualenv as a separate step: Only re-execute this step when requirements.txt changes
FROM build AS build-venv
RUN apt-get update && apt-get install --no-install-suggests --no-install-recommends --yes libpq-dev
COPY ./requirements/ /requirements
RUN /venv/bin/pip install --disable-pip-version-check -r /requirements/oss_prod.txt

# Copy the virtualenv into a distroless image
#FROM gcr.io/distroless/python3-debian12
FROM python:3.9-slim AS prod
RUN apt-get update && \
    apt-get install --no-install-suggests --no-install-recommends --yes r-base libpq-dev
COPY --from=build-venv /venv /venv
COPY . /app
WORKDIR /app
ENTRYPOINT ["/venv/bin/python3", "main.py", "7770"]
