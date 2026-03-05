import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'
import SalesforceOAuthCallbackView from '@/views/salesforce/OAuthCallbackView.vue'
import SalesforceUserListView from '@/views/salesforce/UserListView.vue'
import EventListView from '@/views/salesforce/EventListView.vue'
import EventSummaryView from '@/views/salesforce/EventSummaryView.vue'
import DirectLayout from '@/layout/DirectLayout.vue'
import DirectTalkRoomView from '@/views/direct/DirectTalkRoomView.vue'
import DirectOAuthCallbackView from '@/views/direct/OAuthCallbackView.vue'
import DirectIndexView from '@/views/direct/IndexView.vue'
import DirectUserView from '@/views/direct/UserView.vue'
import DirectOrganizationView from '@/views/direct/OrganizationView.vue'
import SalesforceLayout from '@/layout/SalesforceLayout.vue'
import SalesforceIndexView from '@/views/salesforce/IndexView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: AboutView,
    },
    {
      path: '/salesforce',
      name: 'salesforceLayout',
      component: SalesforceLayout,
      redirect: { name: 'salesforceIndex' },
      children: [
        {
          path: 'index',
          name: 'salesforceIndex',
          component: SalesforceIndexView,
        },
        {
          path: 'oauth/callback',
          name: 'salesforceOAuthCallback',
          component: SalesforceOAuthCallbackView,
        },
        {
          path: 'users',
          name: 'salesforceUsers',
          component: SalesforceUserListView,
        },
        {
          path: '/users/:userId/events',
          name: 'salesforceUserEvent',
          component: EventListView,
        },
        {
          path: '/users/:userId/events/summary',
          name: 'salesforceUserEventSummary',
          component: EventSummaryView,
        },
      ],
    },
    {
      path: '/direct',
      name: 'directLayout',
      component: DirectLayout,
      redirect: { name: 'directIndex' },
      children: [
        {
          path: 'index',
          name: 'directIndex',
          component: DirectIndexView,
        },
        {
          path: 'oauth/callback',
          name: 'directOAuthCallback',
          component: DirectOAuthCallbackView,
        },
        {
          path: 'organization',
          name: 'directOrganization',
          component: DirectOrganizationView,
        },
        {
          path: 'talkroom',
          name: 'directTalkRoom',
          component: DirectTalkRoomView,
        },
        {
          path: 'organization/:domainId/users',
          name: 'directUserList',
          component: DirectUserView,
        },
      ],
    },
  ],
})

// router.beforeEach(async (to) => {
//   const code = Array.isArray(to.query.code) ? to.query.code[0] : to.query.code
//   const state = Array.isArray(to.query.state) ? to.query.state[0] : to.query.state

//   if (typeof code !== 'string' || typeof state !== 'string') {
//     if (to.path === '/oauth/callback') {
//       return { name: 'home', replace: true }
//     }
//     return true
//   }

//   try {
//     await handleSalesforceOAuthCallback(code, state)
//   } catch (error) {
//     console.error('Salesforce OAuth callback processing failed:', error)
//   }

//   const cleanedQuery = { ...to.query }
//   delete cleanedQuery.code
//   delete cleanedQuery.state

//   return {
//     path: to.path,
//     query: cleanedQuery,
//     hash: to.hash,
//     replace: true,
//   }
// })

export default router
