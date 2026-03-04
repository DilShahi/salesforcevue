import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'
import { handleSalesforceOAuthCallback } from '@/services/salesforceAuth'
import OAuthCallbackView from '@/views/OAuthCallbackView.vue'
import UserListView from '@/views/UserListView.vue'
import EventListView from '@/views/EventListView.vue'
import EventSummaryView from '@/views/EventSummaryView.vue'
import DirectLayout from '@/layout/DirectLayout.vue'
import DirectTalkRoomView from '@/views/DirectTalkRoomView.vue'
import DirectOAuthCallbackView from '@/views/direct/OAuthCallbackView.vue'

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
      path: '/oauth/callback',
      name: 'oauth-callback',
      component: OAuthCallbackView,
    },
    {
      path: '/direct',
      name: 'directLayout',
      component: DirectLayout,
      redirect: { name: 'directTalkRoom' },
      children: [
        {
          path: 'oauth/callback',
          name: 'directOAuthCallback',
          component: DirectOAuthCallbackView,
        },
        {
          path: 'talkroom',
          name: 'directTalkRoom',
          component: DirectTalkRoomView,
        },
      ],
    },
    {
      path: '/users',
      name: 'users',
      component: UserListView,
    },
    {
      path: '/users/:userId/events',
      name: 'usersEvent',
      component: EventListView,
    },
    {
      path: '/users/:userId/events/summary',
      name: 'usersEventSummary',
      component: EventSummaryView,
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
