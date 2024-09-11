/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { BACKEND_BASE_PATH, IM_API, IM_CONFIG_INDEX } from '../../constants';
import https from 'https';

Cypress.Commands.add('deleteIMJobs', () => {
  // TODO don't directly delete system index, use other way
  cy.task('readCertAndKey').then(({ cert, key }) => {
    // cy.request({
    //   method: "DELETE",
    //   url: `${Cypress.env('openSearchUrl')}/.opendistro-ism*?expand_wildcards=all`,
    //   headers: {},
    //   noAuth: true,
    //   agent: new https.Agent({
    //     cert: cert,
    //     key: key,
    //   }),
    // });

    const options = {
      hostname: `${Cypress.env('openSearchUrl')}`,
      path: '/.opendistro-ism*?expand_wildcards=all',
      method: 'DELETE',
      cert,
      key,
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
    });

    req.on('error', () => {});

    req.end();
  });
  // Clean all ISM policies
  cy.request('GET', `${BACKEND_BASE_PATH}${IM_API.POLICY_BASE}`).then(
    (resp) => {
      const policyIds = resp.body.policies.map((item) => item._id).join(', ');
      if (policyIds.length) {
        for (const policyId of resp.body.policies) {
          cy.request({
            method: 'DELETE',
            url: `${BACKEND_BASE_PATH}${IM_API.POLICY_BASE}/${policyId._id}`,
            failOnStatusCode: true,
          });
        }
      }
    }
  );
  // Clean all ISM jobs
  cy.request('GET', `${BACKEND_BASE_PATH}${IM_API.EXPLAIN_BASE}`).then(
    (resp) => {
      let ismJobIds = Object.keys(resp.body);
      ismJobIds = ismJobIds
        .filter((e) => e !== 'total_managed_indices')
        .join(', ');
      if (ismJobIds.length) {
        cy.request(
          'POST',
          `${BACKEND_BASE_PATH}${IM_API.REMOVE_POLICY_BASE}/${ismJobIds}`
        );
      }
    }
  );
});

Cypress.Commands.add('createPolicy', (policyId, policyJSON) => {
  cy.request(
    'PUT',
    `${Cypress.env('openSearchUrl')}${IM_API.POLICY_BASE}/${policyId}`,
    policyJSON
  );
});

Cypress.Commands.add('updateManagedIndexConfigStartTime', (index) => {
  // TODO directly changing system index will not be supported, need to introduce new way
  // Creating closure over startTime so it's not calculated until actual update_by_query call
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(1000).then(() => {
    const FIVE_MINUTES_MILLIS = 5 * 60 * 1000; // Default ISM job interval
    const THREE_SECONDS_MILLIS = 3000; // Subtract 3 seconds to account for buffer of updating doc, descheduling, rescheduling
    const startTime =
      new Date().getTime() - (FIVE_MINUTES_MILLIS - THREE_SECONDS_MILLIS);
    const body = {
      query: { term: { 'managed_index.index': index } },
      script: {
        lang: 'painless',
        source: `ctx._source['managed_index']['schedule']['interval']['start_time'] = ${startTime}L`,
      },
    };
    // cy.request(
    //   'POST',
    //   `${Cypress.env('openSearchUrl')}/${
    //     IM_CONFIG_INDEX.OPENDISTRO_ISM_CONFIG
    //   }/_update_by_query`,
    //   body
    // );
    cy.task('readCertAndKey').then(({ cert, key }) => {
      const options = {
        hostname: `${Cypress.env('openSearchUrl')}`,
        path: `/${IM_CONFIG_INDEX.OPENDISTRO_ISM_CONFIG}/_update_by_query`,
        method: 'POST',
        cert,
        key,
      };

      const req = https.request(options, (res) => {
        res.on('data', () => {});
      });

      req.on('error', () => {});

      req.write(JSON.stringify(body));

      req.end();
    });
  });
});

Cypress.Commands.add('createRollup', (rollupId, rollupJSON) => {
  cy.request(
    'PUT',
    `${Cypress.env('openSearchUrl')}${IM_API.ROLLUP_JOBS_BASE}/${rollupId}`,
    rollupJSON
  );
});

Cypress.Commands.add('deleteTemplate', (name) => {
  cy.request({
    url: `${Cypress.env('openSearchUrl')}${IM_API.INDEX_TEMPLATE_BASE}/${name}`,
    failOnStatusCode: false,
    method: 'DELETE',
  });
});

Cypress.Commands.add('deleteTemplateComponents', (name) => {
  cy.request({
    url: `${Cypress.env('openSearchUrl')}${
      IM_API.INDEX_TEMPLATE_COMPONENT_BASE
    }/${name}`,
    failOnStatusCode: false,
    method: 'DELETE',
  });
});

Cypress.Commands.add('createTransform', (transformId, transformJSON) => {
  cy.request(
    'PUT',
    `${Cypress.env('openSearchUrl')}${
      IM_API.TRANSFORM_JOBS_BASE
    }/${transformId}`,
    transformJSON
  );
});

Cypress.Commands.add('createPipeline', (pipelineId, pipelineJSON) => {
  cy.request(
    'PUT',
    `${Cypress.env('openSearchUrl')}/_ingest/pipeline/${pipelineId}`,
    pipelineJSON
  );
});

Cypress.Commands.add('disableJitter', () => {
  // Sets the jitter to 0 in the ISM plugin cluster settings
  const jitterJson = {
    persistent: {
      plugins: {
        index_state_management: {
          jitter: '0.0',
        },
      },
    },
  };
  cy.request(
    'PUT',
    `${Cypress.env('openSearchUrl')}/_cluster/settings`,
    jitterJson
  );
});

Cypress.Commands.add('addIndexAlias', (alias, index) => {
  cy.request({
    url: `${Cypress.env('openSearchUrl')}/_aliases`,
    method: 'POST',
    body: {
      actions: [
        {
          add: {
            index,
            alias,
          },
        },
      ],
    },
    failOnStatusCode: false,
  });
});

Cypress.Commands.add('removeIndexAlias', (alias) => {
  cy.request({
    url: `${Cypress.env('openSearchUrl')}/_aliases`,
    method: 'POST',
    body: {
      actions: [
        {
          remove: {
            index: '*',
            alias,
          },
        },
      ],
    },
    failOnStatusCode: false,
  });
});
