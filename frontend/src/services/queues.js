import api from "./api.js";

export async function getQueue(id) {
  const { data } = await api.get(`/api/queues/${id}`);
  return data;
}

export async function updateQueue(id, payload) {
  const { data } = await api.patch(`/api/queues/${id}`, payload);
  return data;
}

export async function takeTicket(queueId) {
  const { data } = await api.post(`/api/queues/${queueId}/tickets`);
  return data;
}

export async function listQueueTickets(queueId) {
  const { data } = await api.get(`/api/queues/${queueId}/tickets`);
  return data;
}

export async function callNext(queueId) {
  const { data } = await api.post(`/api/queues/${queueId}/call-next`);
  return data;
}

export async function getQueueStats(queueId) {
  const { data } = await api.get(`/api/queues/${queueId}/stats`);
  return data;
}